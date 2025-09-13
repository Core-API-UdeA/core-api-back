module.exports = function badToken(optionalData) {
  const req = this.req;
  const res = this.res;

  const statusCodeToSet = 401;

  if (optionalData === undefined) {
    sails.log.debug("\n--------> BadToken()\n\n");
    return res.sendStatus(statusCodeToSet);
  }

  if (_.isError(optionalData)) {
    if (!_.isFunction(optionalData.toJSON)) {
      return process.env.NODE_ENV === "production"
        ? res.sendStatus(statusCodeToSet)
        : res.status(statusCodeToSet).send(optionalData.stack);
    }
  }

  return res.status(statusCodeToSet).send(optionalData);
};
