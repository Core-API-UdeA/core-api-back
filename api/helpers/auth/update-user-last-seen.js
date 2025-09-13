const flaverr = require("flaverr");

module.exports = {
  friendlyName: "Update User Last Seen",

  description: "Updates the last seen timestamp of the user.",

  inputs: {
    userId: {
      description: "The ID of the user to update.",
      type: "string",
      required: true,
    },
  },

  exits: {},

  fn: async function ({ userId }) {
    sails.log.verbose(
      "\n--------> Helper to update user's last seen timestamp\n\n"
    );

    try {
      const user = await User.findOne({ id: userId });

      if (!user) {
        throw flaverr(
          {
            code: "E_MODEL_USER_NOT_FOUND",
            name: "notFound",
          },
          new Error("No user found with the specified ID")
        );
      }

      const updatedUser = await Usuario.updateOne({ id: userId }).set({
        lastSeen: Date.now(),
      });

      sails.log.debug("\nUpdated User:", updatedUser);
      return updatedUser;
    } catch (err) {
      if (flaverr.taste("notFound", err)) {
        throw err;
      }
      sails.log.error("Error updating user's last seen timestamp:", err);
      throw err;
    }
  },
};