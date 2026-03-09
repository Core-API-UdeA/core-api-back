Feature: Pagos y Suscripciones
  Como usuario autenticado de Core API
  Quiero gestionar mis pagos y suscripciones
  Para acceder a APIs de pago en el catalogo

  # ─── CHECKOUT ───────────────────────────────────────────────

  Scenario: PAG-01 | Crear checkout sin autenticacion
    Given que el servidor esta disponible
    When checkout sin token con planId "plan-123"
    Then la respuesta tiene codigo 403

  Scenario: PAG-02 | Crear checkout con planId invalido
    Given que el servidor esta disponible
    And tengo un token valido del usuario "andres.lema1@udea.edu.co" con password "Temporal1*"
    When checkout con el token y planId "plan-inexistente-xyz"
    Then la respuesta tiene codigo 400

  Scenario: PAG-03 | Crear checkout sin body
    Given que el servidor esta disponible
    And tengo un token valido del usuario "andres.lema1@udea.edu.co" con password "Temporal1*"
    When checkout con el token y sin body
    Then la respuesta tiene codigo 400

  # ─── TRANSACCIONES ──────────────────────────────────────────

  Scenario: PAG-04 | Listar transacciones sin autenticacion
    Given que el servidor esta disponible
    When mis transacciones sin token
    Then la respuesta tiene codigo 403

  Scenario: PAG-05 | Listar transacciones autenticado
    Given que el servidor esta disponible
    And tengo un token valido del usuario "andres.lema1@udea.edu.co" con password "Temporal1*"
    When mis transacciones con el token
    Then la respuesta tiene codigo 200
    And la respuesta es exitosa

  Scenario: PAG-06 | Consultar transaccion con ID inexistente
    Given que el servidor esta disponible
    And tengo un token valido del usuario "andres.lema1@udea.edu.co" con password "Temporal1*"
    When consultar transaccion "id-inexistente-xyz" con el token
    Then la respuesta tiene codigo 200
    And la respuesta es un error con mensaje "NOK"

  # ─── SUSCRIPCIONES ──────────────────────────────────────────

  Scenario: PAG-07 | Listar suscripciones sin autenticacion
    Given que el servidor esta disponible
    When mis suscripciones sin token
    Then la respuesta tiene codigo 404

  Scenario: PAG-08 | Listar suscripciones autenticado
    Given que el servidor esta disponible
    And tengo un token valido del usuario "andres.lema1@udea.edu.co" con password "Temporal1*"
    When mis suscripciones con el token
    Then la respuesta tiene codigo 404
