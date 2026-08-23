const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    result.error.status = 422;
    return next(result.error);
  }
  // Express 5 exposes req.query as an uncached getter, so parsed values are
  // published on req.data.<source>; mutating req.query directly does not stick.
  req.data = { ...req.data, [source]: result.data };
  const target = req[source];
  if (target && typeof target === 'object' && source !== 'query') {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, result.data);
  }
  next();
};

module.exports = validate;
