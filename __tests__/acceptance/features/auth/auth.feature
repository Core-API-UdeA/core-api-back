Feature: Autenticacion de Usuarios
  Como usuario de la plataforma Core API
  Quiero poder registrarme e iniciar sesion
  Para acceder al catalogo de APIs

  # ─── REGISTRO ───────────────────────────────────────────────

  Scenario: REG-01 | Registro exitoso con datos validos
    Given que el servidor esta disponible
    When registro con email "testuser_acp3@mail.com", username "testuseracp3" y password "TestPass123"
    Then la respuesta tiene codigo 200
    And la respuesta es exitosa

  Scenario: REG-02 | Registro con email ya existente
    Given que el servidor esta disponible
    When registro con email "andres.lema1@udea.edu.co", username "otrousuario" y password "TestPass123"
    Then la respuesta tiene codigo 200
    And la respuesta es un error con mensaje "The email is already registered"

  Scenario: REG-03 | Registro con password muy corta
    Given que el servidor esta disponible
    When registro con email "nuevo2@mail.com", username "nuevousr2" y password "abc"
    Then la respuesta tiene codigo 400

  Scenario: REG-04 | Registro sin campo email
    Given que el servidor esta disponible
    When registro sin email, con username "sinEmail" y password "TestPass123"
    Then la respuesta tiene codigo 400

  Scenario: REG-05 | Registro con username muy corto
    Given que el servidor esta disponible
    When registro con email "short@mail.com", username "ab" y password "TestPass123"
    Then la respuesta tiene codigo 400

  # ─── LOGIN ──────────────────────────────────────────────────

  Scenario: LOG-01 | Login exitoso con credenciales correctas
    Given que el servidor esta disponible
    When login con email "andres.lema1@udea.edu.co" y password "Temporal1*"
    Then la respuesta tiene codigo 200
    And la respuesta contiene un token JWT
    And la respuesta contiene datos del usuario

  Scenario: LOG-02 | Login con password incorrecta
    Given que el servidor esta disponible
    When login con email "andres.lema1@udea.edu.co" y password "WrongPass999"
    Then la respuesta tiene codigo 200
    And la respuesta es un error con mensaje "NOK"

  Scenario: LOG-03 | Login con email no registrado
    Given que el servidor esta disponible
    When login con email "noexiste@mail.com" y password "TestPass123"
    Then la respuesta tiene codigo 200
    And la respuesta es un error con mensaje "NOK"

  Scenario: LOG-04 | Login con email invalido
    Given que el servidor esta disponible
    When login con email "noesunemail" y password "TestPass123"
    Then la respuesta tiene codigo 400

  Scenario: LOG-05 | Login con password vacia
    Given que el servidor esta disponible
    When login con email "andres.lema1@udea.edu.co" y password ""
    Then la respuesta tiene codigo 400

  # ─── FETCH ──────────────────────────────────────────────────

  Scenario: FET-01 | Fetch de usuario autenticado con token valido
    Given que el servidor esta disponible
    And tengo un token valido del usuario "andres.lema1@udea.edu.co" con password "Temporal1*"
    When fetch con el token
    Then la respuesta tiene codigo 200
    And la respuesta contiene datos del usuario

  Scenario: FET-02 | Fetch sin token
    Given que el servidor esta disponible
    When fetch sin token
    Then la respuesta tiene codigo 403
