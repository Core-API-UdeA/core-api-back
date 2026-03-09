'use strict';

const { When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

When('checkout sin token con planId {string}', async function (planId) {
  this.response = await this.request
    .post('/scapi/pagos/crear-checkout')
    .send({ planId });
});

When('checkout con el token y planId {string}', async function (planId) {
  this.response = await this.request
    .post('/scapi/pagos/crear-checkout')
    .set('Authorization', `Bearer ${this.token}`)
    .send({ planId });
});

When('checkout con el token y sin body', async function () {
  this.response = await this.request
    .post('/scapi/pagos/crear-checkout')
    .set('Authorization', `Bearer ${this.token}`)
    .send({});
});

When('mis transacciones sin token', async function () {
  this.response = await this.request
    .get('/scapi/pagos/mis-transacciones');
});

When('mis transacciones con el token', async function () {
  this.response = await this.request
    .get('/scapi/pagos/mis-transacciones')
    .set('Authorization', `Bearer ${this.token}`);
});

When('consultar transaccion {string} con el token', async function (transactionId) {
  this.response = await this.request
    .get(`/scapi/pagos/transaccion/${transactionId}`)
    .set('Authorization', `Bearer ${this.token}`);
});

When('mis suscripciones sin token', async function () {
  this.response = await this.request
    .get('/scapi/suscripciones/mis-suscripciones');
});

When('mis suscripciones con el token', async function () {
  this.response = await this.request
    .get('/scapi/suscripciones/mis-suscripciones')
    .set('Authorization', `Bearer ${this.token}`);
});

Then('la respuesta contiene un array de transacciones', function () {
  const data = this.response.body.ejecucion?.data ?? this.response.body;
  const arr = Array.isArray(data) ? data : Object.values(data)[0];
  assert.ok(Array.isArray(arr), `Se esperaba un array, se recibio: ${JSON.stringify(data)}`);
});

Then('la respuesta contiene un array de suscripciones', function () {
  const data = this.response.body.ejecucion?.data ?? this.response.body;
  const arr = Array.isArray(data) ? data : Object.values(data)[0];
  assert.ok(Array.isArray(arr), `Se esperaba un array, se recibio: ${JSON.stringify(data)}`);
});
