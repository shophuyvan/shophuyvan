function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function validate(schema, data) {
  const errors = [];
  
  function check(s, d, path = '') {
    if (!s) return;
    
    // Type check
    if (s.type) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      const actualType = typeOf(d);
      const isValid = types.includes(actualType) || 
                     (types.includes('number') && !isNaN(Number(d)));
      
      if (!isValid) {
        errors.push(`${path || 'data'}: expected ${types.join('|')} but got ${actualType}`);
        return;
      }
    }
    
    // Required fields check
    if (s.required && typeOf(d) === 'object') {
      for (const key of s.required) {
        if (!(key in d)) {
          errors.push(`${path || 'data'}.${key} is required`);
        }
      }
    }
    
    // Properties check (nested objects)
    if (s.properties && typeOf(d) === 'object') {
      for (const [key, subSchema] of Object.entries(s.properties)) {
        if (d[key] !== undefined) {
          check(subSchema, d[key], (path ? path + '.' : '') + key);
        }
      }
    }
    
    // Items check (arrays)
    if (s.items && typeOf(d) === 'array') {
      d.forEach((item, index) => {
        check(s.items, item, (path ? path : 'data') + `[${index}]`);
      });
    }
  }
  
  check(schema, data, '');
  
  return {
    ok: errors.length === 0,
    errors
  };
}

// Common schemas
export const SCH = {
  address: {
    type: 'object',
    required: ['name', 'phone', 'address', 'province_code', 'district_code', 'commune_code']
  },
  
  orderItem: {
    type: 'object',
    required: ['name', 'price', 'qty']
  },
  
  orderCreate: {
    type: 'object',
    required: ['customer', 'items'],
    properties: {
      customer: {
        type: 'object',
        required: ['name', 'phone', 'address', 'province_code', 'district_code', 'commune_code']
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'price', 'qty']
        }
      },
      totals: {
        type: 'object',
        properties: {
          shipping_fee: { type: 'number' },
          discount: { type: 'number' },
          shipping_discount: { type: 'number' }
        }
      }
    }
  }
};
