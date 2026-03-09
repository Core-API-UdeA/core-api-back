'use strict';

const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

Given('que el servidor esta disponible', async function () {
  const res = await this.request.get('/');
  assert.ok(res.status < 500);
});

Given('tengo un token valido del usuario {string} con password {string}', async function (email, password) {
  const res = await this.request
    .post('/scapi/auth/login')
    .send({ email, password });

  assert.strictEqual(res.status, 200);
  this.token = res.body.ejecucion?.data?.token;
  assert.ok(this.token, `Token no encontrado. Body: ${JSON.stringify(res.body)}`);
});

When('registro con email {string}, username {string} y password {string}',
  async function (email, username, password) {
    this.response = await this.request
      .post('/scapi/auth/register')
      .send({ email, username, password });
  }
);

When('registro sin email, con username {string} y password {string}',
  async function (username, password) {
    this.response = await this.request
      .post('/scapi/auth/register')
      .send({ username, password });
  }
);

When('login con email {string} y password {string}',
  async function (email, password) {
    this.response = await this.request
      .post('/scapi/auth/login')
      .send({ email, password });
  }
);

When('fetch con el token', async function () {
  this.response = await this.request
    .get('/scapi/auth/fetch')
    .set('Authorization', `Bearer ${this.token}`);
});

When('fetch sin token', async function () {
  this.response = await this.request
    .get('/scapi/auth/fetch');
});

Then('la respuesta tiene codigo {int}', function (expectedStatus) {
  assert.strictEqual(this.response.status, expectedStatus);
});

Then('la respuesta es exitosa', function () {
  const estado = this.response.body.ejecucion?.respuesta?.estado;
  assert.strictEqual(estado, 'OK', `Se esperaba estado OK, se recibio: ${estado}`);
});

Then('la respuesta es un error con mensaje {string}', function (expectedMsg) {
  const respuesta = this.response.body.ejecucion?.respuesta;
  assert.strictEqual(respuesta?.estado, 'NOK');
  assert.ok(
    JSON.stringify(respuesta).includes(expectedMsg),
    `Mensaje esperado: "${expectedMsg}" no encontrado en: ${JSON.stringify(respuesta)}`
  );
});

Then('la respuesta contiene el mensaje {string}', function (expectedMsg) {
  const body = JSON.stringify(this.response.body);
  assert.ok(body.includes(expectedMsg), `Mensaje "${expectedMsg}" no encontrado en: ${body}`);
});

Then('la respuesta contiene un token JWT', function () {
  const token = this.response.body.ejecucion?.data?.token;
  assert.ok(token, `Token no encontrado en: ${JSON.stringify(this.response.body)}`);
  assert.strictEqual(typeof token, 'string');
  assert.strictEqual(token.split('.').length, 3);
});

Then('la respuesta contiene datos del usuario', function () {
  const user = this.response.body.ejecucion?.data?.user;
  assert.ok(user, `User no encontrado en: ${JSON.stringify(this.response.body)}`);
  assert.ok(user.email);
});
