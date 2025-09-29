const Joi = require("joi");

module.exports = async function (req, res, proceed) {
  try {
    sails.log.debug("\n==============================\n");
    sails.log.debug("\tValidate Login Params policy");
    sails.log.debug("\n==============================\n");

    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).max(40).required(),
    })

    const { error } = await schema.validateAsync(req.allParams());

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
  } catch (error) {
    sails.log.error("\n\nError in validation params: ", error, "\n\n");

    if (error.name === "ValidationError") {
      return res.badRequest({ error });
    }
    return res.serverError({ error });
  }

  return proceed();
};
