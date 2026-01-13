// import { Document } from 'mongoose';

// const deleteAtPath = (obj: any, path: any, index: number) => {
//   if (index === path.length - 1) {
//     // eslint-disable-next-line no-param-reassign
//     delete obj[path[index]];
//     return;
//   }
//   deleteAtPath(obj[path[index]], path, index + 1);
// };

// const toJSON = (schema: any) => {
//   let transform: Function;
//   if (schema.options.toJSON && schema.options.toJSON.transform) {
//     transform = schema.options.toJSON.transform;
//   }

//   // eslint-disable-next-line no-param-reassign
//   schema.options.toJSON = Object.assign(schema.options.toJSON || {}, {
//     transform(doc: Document, ret: any, options: Record<string, any>) {
//       Object.keys(schema.paths).forEach((path) => {
//         if (schema.paths[path].options && schema.paths[path].options.private) {
//           deleteAtPath(ret, path.split('.'), 0);
//         }
//       });

//       // eslint-disable-next-line no-param-reassign
//       ret.id = ret._id.toString();
//       // eslint-disable-next-line no-param-reassign
//       delete ret._id;
//       // eslint-disable-next-line no-param-reassign
//       delete ret.__v;
//       // eslint-disable-next-line no-param-reassign
//       delete ret.createdAt;
//       // eslint-disable-next-line no-param-reassign
//       delete ret.updatedAt;
//       if (transform) {
//         return transform(doc, ret, options);
//       }
//     },
//   });
// };

// export default toJSON;

import { Document } from 'mongoose';

const deleteAtPath = (obj: any, path: any, index: number) => {
  if (index === path.length - 1) {
    // eslint-disable-next-line no-param-reassign
    delete obj[path[index]];
    return;
  }
  deleteAtPath(obj[path[index]], path, index + 1);
};

const transformObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = transformObject(obj[i]);
    }
    return obj;
  }

  if (obj._id !== undefined) {
    obj.id = obj._id;
    delete obj._id;
  }
  if (obj.__v !== undefined) {
    delete obj.__v;
  }
  if (obj.createdAt !== undefined) {
    delete obj.createdAt;
  }
  if (obj.updatedAt !== undefined) {
    delete obj.updatedAt;
  }

  // Recurse into nested properties
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = transformObject(obj[key]);
    }
  }

  return obj;
};

const toJSON = (schema: any) => {
  let transform: Function;
  if (schema.options.toJSON && schema.options.toJSON.transform) {
    transform = schema.options.toJSON.transform;
  }

  // eslint-disable-next-line no-param-reassign
  schema.options.toJSON = Object.assign(schema.options.toJSON || {}, {
    transform(doc: Document, ret: any, options: Record<string, any>) {
      // Remove private fields first (recursive via paths)
      Object.keys(schema.paths).forEach((path) => {
        if (schema.paths[path].options && schema.paths[path].options.private) {
          deleteAtPath(ret, path.split('.'), 0);
        }
      });

      const clonedRet = JSON.parse(JSON.stringify(ret));

      const transformed = transformObject(clonedRet);

      if (transform) {
        return transform(doc, transformed, options);
      }
      return transformed;
    },
  });
};

export default toJSON;