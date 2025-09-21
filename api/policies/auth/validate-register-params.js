const Joi = require('joi');

module.exports = async function (req, res, proceed) {
  try {
    sails.log.debug('\n==============================\n');
    sails.log.debug('\tValidate Register Params policy');
    sails.log.debug('\n==============================\n');

    // Definir esquema de validación para registro
    const schema = Joi.object({
      email: Joi.string().email().required(),
      username: Joi.string().min(3).max(60).required(),
      password: Joi.string().min(8).required(),
      rol: Joi.string().valid('usuario', 'admin').optional() // Aca la idea es que se use el de defecto 'usuario'
    });

    // validar
    await schema.validateAsync(req.allParams(), { abortEarly: true });
  } catch (error) {
    sails.log.error('\n\nError in validation params: ', error, '\n\n');

    if (error.name === 'ValidationError') {
      return res.badRequest({ error: error.details[0].message });
    }
    return res.serverError({ error });
  }

  return proceed();
};
