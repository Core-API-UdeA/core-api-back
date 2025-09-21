module.exports = {
  friendlyName: "Crear usuario",

  description: "Crea un usuario admin en la base de datos",

  fn: async function () {
    sails.log("Running custom shell script... (`sails run crear-usuario-temp`)");

    const email = "example@example.com";
    const password = "temporal";
    const username = "Admin Temporal";
    const rol = "admin";
    const estado = "Confirmed";

    // Hashear la contraseña
    const hashed = await sails.helpers.passwords.hashPassword(password);

    // Crear el usuario
    const nuevoUsuario = await User.create({
      email,
      password: hashed,
      username,
      rol,
      estado,
    }).fetch();

    sails.log(`Usuario creado: ${nuevoUsuario.email} (id: ${nuevoUsuario.id})`);
  },
};
