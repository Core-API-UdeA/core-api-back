module.exports = {
  friendlyName: "Fetch",

  description: "Controller action for re-logging in a user.",

  inputs: {
    uuidOrganizacion: {
      type: 'string',
      required: false
    }
  },

  exits: {
    success: {
      description: "The requesting user agent has been successfully logged in.",
      responseType: "okResponse",
    },

    errorGeneral: {
      description: "Error logging in user.",
      responseType: "nokResponse",
    },
  },

  fn: async function ({uuidOrganizacion}, exits) {
    try {
      sails.log.verbose("\n--------> Controller de fetch (recuperación de sesión)\n\n");

      const decoded = this.req.decoded;

      sails.log.verbose("Decoded JWT:", decoded);

      const userId = typeof decoded.sub === "object" ? decoded.sub.id : decoded.sub;

      let user = await User.findOne({ id: userId });

      if (!user) {
        return exits.errorGeneral("User not found");
      }

      await sails.helpers.auth.updateUserLastSeen.with({ userId: user.id });

      const payload = {
        user: user,
        rol: user.rol,
      };

      const newToken = await sails.helpers.auth.generateJwtToken.with({
        subject: payload,
      });


      return exits.success({
        mensaje: `${user.email} has been re-logged in`,
        data: {
          user,
          token: newToken,
        },
      });
    } catch (error) {
      sails.log.error("Error en fetch:", error);
      return exits.errorGeneral("Error logging in user");
    }
  },
};