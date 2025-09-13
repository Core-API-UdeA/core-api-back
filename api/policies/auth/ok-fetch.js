module.exports = async function (req, res, proceed) {
  try {
    sails.log.debug("\n==============================\n");
    sails.log.debug("\tok-fetch policy");
    sails.log.debug("\n==============================\n");

    if (!req.headers.authorization) {
      return res.forbidden("No authorization token found");
    }

    const authorization = req.headers.authorization.split(" ");

    token = authorization[1];
    prefixtoken = authorization[0];

    if (prefixtoken !== "Bearer") {
      return res.forbidden("Invalid authorization token prefix");
    }

    const decoded = await sails.helpers.auth.verifyJwtToken.with({
      token: token,
    });

    if (!decoded) {
      return res.forbidden("Invalid authorization token");
    }

    req.decoded = decoded;
    req.token = token;

    sails.log.verbose("\n\nSession fetch successful!\n\n");
  } catch (error) {
    sails.log.error("\n\nError in fetching session: ", error, "\n\n");

    if (error.name === "ValidationError") {
      return res.badRequest({ error });
    }
    return res.serverError({ error });
  }

  return proceed();
};