import Clinic from '@models/clinic.model';
import { leadApiRequest, leadApiUpload } from './lead.client';
import {
    CreateLeadDTO,
    UpdateLeadDTO,
    EditArrivedLeadDTO,
    ListLeadQueryDTO,
} from '@validations/lead.validation';
import {
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    InternalServerException,
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose from 'mongoose';

const NO_PHONE_SENTINEL = '-';

export class LeadService {

    private async getAssignedLeadClinics(
        userId: string
    ): Promise<{ synergyClinicId: string; leadClinicId: number; name: string }[]> {
        const clinics = await Clinic.findByUser(userId);
        const mapped = clinics
            .filter((c) => typeof c.leadClinicId === 'number')
            .map((c) => ({
                synergyClinicId: (c._id as mongoose.Types.ObjectId).toString(),
                leadClinicId: c.leadClinicId as number,
                name: c.name.th || c.name.en,
            }));

        if (mapped.length === 0) {
            logger.warn(`LeadService: user ${userId} has no clinics with leadClinicId configured`);
        }

        return mapped;
    }

    private async resolveClinicForUser(
        synergyClinicId: string,
        userId: string
    ): Promise<{ leadClinicId: number; name: string; branch: string }> {
        if (!mongoose.Types.ObjectId.isValid(synergyClinicId)) {
            throw new BadRequestException('Invalid clinic ID');
        }

        const clinic = await Clinic.findById(synergyClinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        if (!clinic.assignedTo.some((id) => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to create leads for this clinic');
        }

        if (typeof clinic.leadClinicId !== 'number') {
            throw new BadRequestException(
                `Clinic "${clinic.name.th || clinic.name.en}" is not linked to the lead system yet (missing leadClinicId)`
            );
        }

        const name = clinic.name.th || clinic.name.en;
        return {
            leadClinicId: clinic.leadClinicId,
            name,
            branch: name,
        };
    }

    private async assertLeadInScope(leadClinicId: number | undefined, userId: string): Promise<number> {
        if (typeof leadClinicId !== 'number') {
            throw new InternalServerException('Lead is missing a valid clinic reference');
        }
        const allowed = await this.getAssignedLeadClinics(userId);
        const isAllowed = allowed.some((c) => c.leadClinicId === leadClinicId);
        if (!isAllowed) {
            throw new ForbiddenException('Not authorized to access this lead');
        }
        return leadClinicId;
    }

    private combineDateTime(date?: string, time?: string): string | undefined {
        if (!date) return undefined;
        const t = time || '00:00';
        return new Date(`${date}T${t}:00`).toISOString();
    }

    async listLeads(query: ListLeadQueryDTO, userId: string) {
        let targetClinics = await this.getAssignedLeadClinics(userId);

        if (query.clinicId) {
            const resolved = await this.resolveClinicForUser(query.clinicId, userId);
            targetClinics = targetClinics.filter((c) => c.leadClinicId === resolved.leadClinicId);
        }

        if (targetClinics.length === 0) {
            return {
                leads: [],
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false,
                },
            };
        }

        const statusesToQuery: (string | undefined)[] =
            query.status && query.status.length > 0 ? query.status : [undefined];

        const MERGE_FETCH_LIMIT = 200;

        const requests = targetClinics.flatMap((c) =>
            statusesToQuery.map((status) =>
                leadApiRequest<any[]>('/leads', {
                    method: 'GET',
                    query: {
                        clinic_id: c.leadClinicId,
                        status,
                        start_date: query.startDate,
                        end_date: query.endDate,
                        search: query.search,
                        page: 1,
                        limit: MERGE_FETCH_LIMIT,
                        sort_by: query.sortBy,
                        sort_order: query.sortOrder,
                    },
                }).catch((err) => {
                    logger.warn(
                        `LeadService: failed to fetch leads for clinic ${c.leadClinicId}, status ${status || 'any'}`,
                        { error: err.message }
                    );
                    return [] as any[];
                })
            )
        );

        const results = await Promise.all(requests);
        const flatLeads = results.flat();

        const seen = new Set<string>();
        const allLeads = flatLeads.filter((l) => {
            const id = l._id || l.id;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });

        const sortKey = query.sortBy || 'createdAt';
        const sortDir = query.sortOrder === 'asc' ? 1 : -1;
        allLeads.sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (av === bv) return 0;
            return av > bv ? sortDir : -sortDir;
        });

        const total = allLeads.length;

        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const start = (page - 1) * limit;
        const paged = allLeads.slice(start, start + limit);

        return {
            leads: paged.map((l) => this.transformLeadFromApi(l)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
            },
        };
    }

    async getLeadById(id: string, userId: string) {
        const lead = await leadApiRequest<any>(`/leads/${id}`, { method: 'GET' });
        if (!lead) {
            throw new NotFoundException('Lead not found');
        }
        await this.assertLeadInScope(lead.clinic?.clinicId, userId);
        return this.transformLeadFromApi(lead);
    }

    async getLeadHistory(id: string, userId: string) {
        const lead = await leadApiRequest<any>(`/leads/${id}`, { method: 'GET' });
        if (!lead) {
            throw new NotFoundException('Lead not found');
        }
        const leadClinicId = await this.assertLeadInScope(lead.clinic?.clinicId, userId);

        const result = await leadApiRequest<{ current: any; history: any[]; totalVisits: number }>(
            `/leads/history/${id}`,
            {
                method: 'GET',
                query: { clinic_id: leadClinicId },
            }
        );

        return {
            current: this.transformLeadFromApi(result.current),
            history: (result.history || []).map((l) => this.transformLeadFromApi(l)),
            totalVisits: result.totalVisits,
        };
    }

    async createLead(data: CreateLeadDTO, userId: string) {
        const clinic = await this.resolveClinicForUser(data.clinicId, userId);

        const body = {
            patientId: data.patientId,
            patient: {
                fullname: data.fullname,
                nickname: data.nickname,
                tel: data.tel || NO_PHONE_SENTINEL,
                socialMedia: data.socialMedia,
            },
            clinic: {
                clinicId: clinic.leadClinicId,
                name: clinic.name,
                branch: clinic.branch,
            },
            appointments: {
                status: data.status,
                date: this.combineDateTime(data.appointmentDate, data.appointmentTime),
            },
            interests: data.interestName ? [{ name: data.interestName }] : [],
            referralChannel: data.referralChannel,
            note: data.note,
            createdBy: data.createdBy,
            ...(data.deposit ? { deposit: data.deposit } : {}),
        };

        const result = await leadApiRequest<any>('/leads', {
            method: 'POST',
            body,
        });

        logger.info(`Lead created for clinic ${clinic.name} by ${userId}`);
        return this.transformLeadFromApi(result);
    }

    async updateLead(id: string, data: UpdateLeadDTO, userId: string) {
        const existing = await leadApiRequest<any>(`/leads/${id}`, { method: 'GET' });
        if (!existing) {
            throw new NotFoundException('Lead not found');
        }
        const leadClinicId = await this.assertLeadInScope(existing.clinic?.clinicId, userId);

        const body: Record<string, any> = {
            updatedBy: userId,
        };

        if (data.patientId !== undefined) body.patientId = data.patientId;

        const patientPatch: Record<string, any> = {};
        if (data.fullname !== undefined) patientPatch.fullname = data.fullname;
        if (data.nickname !== undefined) patientPatch.nickname = data.nickname;
        if (data.tel !== undefined) patientPatch.tel = data.tel || NO_PHONE_SENTINEL;
        if (data.socialMedia !== undefined) patientPatch.socialMedia = data.socialMedia;
        if (Object.keys(patientPatch).length > 0) body.patient = patientPatch;

        if (data.interestName !== undefined) {
            body.interests = [{ name: data.interestName }];
        }

        if (data.status !== undefined || data.appointmentDate !== undefined || data.appointmentTime !== undefined) {
            body.appointments = {
                ...(data.status !== undefined ? { status: data.status } : {}),
                ...(data.appointmentDate !== undefined
                    ? { date: this.combineDateTime(data.appointmentDate, data.appointmentTime) }
                    : {}),
            };
        }

        if (data.referralChannel !== undefined) body.referralChannel = data.referralChannel;
        if (data.note !== undefined) body.note = data.note;
        if (data.deposit !== undefined) body.deposit = data.deposit;

        const result = await leadApiRequest<any>(`/leads/${id}`, {
            method: 'PUT',
            query: { clinic_id: leadClinicId },
            body,
        });

        logger.info(`Lead ${id} updated by ${userId}`);
        return this.transformLeadFromApi(result);
    }

    async editArrivedLead(id: string, data: EditArrivedLeadDTO, userId: string) {
        const existing = await leadApiRequest<any>(`/leads/${id}`, { method: 'GET' });
        if (!existing) {
            throw new NotFoundException('Lead not found');
        }
        const leadClinicId = await this.assertLeadInScope(existing.clinic?.clinicId, userId);

        if (existing.appointments?.status !== 'arrived') {
            throw new BadRequestException('Can only edit procedures for leads with status "arrived"');
        }

        const result = await leadApiRequest<any>(`/leads/${id}`, {
            method: 'PUT',
            query: { clinic_id: leadClinicId },
            body: {
                procedures: data.procedures,
                payments: data.payments,
                receiptUrls: data.receiptUrls,
                editNote: data.editNote,
                updatedBy: userId,
            },
        });

        logger.info(`Lead ${id} arrived-edit by ${userId}`);
        return {
            lead: this.transformLeadFromApi(result),
            previous: existing,
        };
    }

    async deleteLead(id: string, userId: string) {
        const existing = await leadApiRequest<any>(`/leads/${id}`, { method: 'GET' });
        if (!existing) {
            throw new NotFoundException('Lead not found');
        }
        const leadClinicId = await this.assertLeadInScope(existing.clinic?.clinicId, userId);

        await leadApiRequest(`/leads/${id}`, {
            method: 'DELETE',
            query: { clinic_id: leadClinicId },
        });

        logger.info(`Lead ${id} deleted by ${userId}`);
        return true;
    }

    async searchPatients(q: string, limit: number, userId: string): Promise<{ patients: any[] }> {
        const targetClinics = await this.getAssignedLeadClinics(userId);
        if (targetClinics.length === 0) {
            return { patients: [] };
        }

        const results = await Promise.all(
            targetClinics.map((c) =>
                leadApiRequest<any[]>('/patients/search', {
                    method: 'GET',
                    query: { clinic_id: c.leadClinicId, q },
                }).catch((err) => {
                    logger.warn(`LeadService: patient search failed for clinic ${c.leadClinicId}`, {
                        error: err.message,
                    });
                    return [] as any[];
                })
            )
        );

        const merged = results.flat().slice(0, limit);
        return { patients: merged };
    }

    async checkPhoneDuplicate(
        tel: string,
        excludeId: string | undefined,
        userId: string
    ): Promise<{ exists: boolean; patient?: any }> {
        const targetClinics = await this.getAssignedLeadClinics(userId);
        if (targetClinics.length === 0) {
            return { exists: false };
        }

        for (const c of targetClinics) {
            try {
                const result = await leadApiRequest<{ exists: boolean; patient?: any }>(
                    '/patients/check-tel',
                    {
                        method: 'GET',
                        query: { clinic_id: c.leadClinicId, tel },
                    }
                );
                if (result?.exists && result.patient?._id !== excludeId) {
                    return result;
                }
            } catch (err: any) {
                logger.warn(`LeadService: check-tel failed for clinic ${c.leadClinicId}`, {
                    error: err.message,
                });
            }
        }

        return { exists: false };
    }

    async getSettingOptions(userId: string, synergyClinicId?: string): Promise<{ interests: any[]; channels: any[] }> {
        let leadClinicId: number | undefined;

        if (synergyClinicId) {
            const resolved = await this.resolveClinicForUser(synergyClinicId, userId);
            leadClinicId = resolved.leadClinicId;
        } else {
            const clinics = await this.getAssignedLeadClinics(userId);
            leadClinicId = clinics[0]?.leadClinicId;
        }

        if (typeof leadClinicId !== 'number') {
            return { interests: [], channels: [] };
        }

        const result = await leadApiRequest<{
            clinic: any;
            options: { interests: any[]; channels: any[] };
        }>(`/options/clinics/${leadClinicId}`, { method: 'GET' });

        return {
            interests: (result.options?.interests || []).map((i: any) => ({ id: i.id || i.value, name: i.name || i.label })),
            channels: (result.options?.channels || []).map((c: any) => ({ id: c.id || c.value, name: c.name || c.label })),
        };
    }

    async uploadSlip(
        file: { buffer: Buffer; originalname: string; mimetype: string }
    ): Promise<{ url: string }> {
        return leadApiUpload<{ url: string }>('/uploads/slip', file, 'slip');
    }

    async uploadReceipt(
        file: { buffer: Buffer; originalname: string; mimetype: string }
    ): Promise<{ url: string }> {
        return leadApiUpload<{ url: string }>('/uploads/receipt', file, 'receipt');
    }

    private transformLeadFromApi(raw: any) {
        if (!raw) return raw;
        return {
            _id: raw._id || raw.id,
            patientId: raw.patientId,
            patient: {
                fullname: raw.patient?.fullname || '',
                nickname: raw.patient?.nickname,
                tel: raw.patient?.tel,
                socialMedia: raw.patient?.socialMedia,
            },
            clinic: {
                clinicId: raw.clinic?.clinicId,
                name: raw.clinic?.name,
                branch: raw.clinic?.branch,
            },
            appointments: {
                status: raw.appointments?.status,
                date: raw.appointments?.date,
            },
            interests: raw.interests || [],
            procedures: raw.procedures || [],
            payments: raw.payments,
            deposit: raw.deposit,
            receiptUrls: raw.receiptUrls,
            referralChannel: raw.referralChannel,
            note: raw.note,
            arrivedNote: raw.arrivedNote,
            rescheduledNote: raw.rescheduledNote,
            cancelledNote: raw.cancelledNote,
            editHistory: raw.editHistory,
            createdBy: raw.createdBy,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
            previousAppointmentId: raw.previousAppointmentId,
            nextAppointmentId: raw.nextAppointmentId,
        };
    }
}

export default LeadService;