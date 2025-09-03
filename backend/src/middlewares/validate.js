const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    result.error.status = 422;
    return next(result.error);
  }
  req[source] = result.data;
  next();
};

module.exports = validate;
