'use strict';

const { setWorldConstructor, World } = require('@cucumber/cucumber');
const supertest = require('supertest');

const BASE_URL = 'http://localhost:1337';

class CoreApiWorld extends World {
  constructor(options) {
    super(options);

    this.request = supertest(BASE_URL);

    this.response = null;
    this.token    = null;
  }
}

setWorldConstructor(CoreApiWorld);
