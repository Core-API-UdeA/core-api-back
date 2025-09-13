module.exports = function serverError(optionalData) {
  const req = this.req;
  const res = this.res;

  const statusCodeToSet = 500;

  if (optionalData === undefined) {
    sails.log.debug("\n--------> ServerError()\n\n");
    return res.sendStatus(statusCodeToSet);
  }

  if (_.isError(optionalData)) {
    if (!_.isFunction(optionalData.toJSON)) {
      return process.env.NODE_ENV === 'production'
        ? res.sendStatus(statusCodeToSet)
        : res.status(statusCodeToSet).send(optionalData.stack);
    }
  }

  return res.status(statusCodeToSet).send(optionalData);
};
