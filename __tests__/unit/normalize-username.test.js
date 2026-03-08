'use strict';

const proxyquire = require('proxyquire').noCallThru();

const sailsMock = {
  log: {
    verbose: jest.fn(),
    debug:   jest.fn(),
    error:   jest.fn(),
  },
};

global.sails = sailsMock;

const normalizeHelper = proxyquire(
  '../../api/helpers/util/normalize-username',
  {
    flaverr: require('flaverr'),
  }
);

async function normalize(name) {
  return normalizeHelper.fn({ name });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('normalizeUsername — Happy Path', () => {

  test('NU-01 | Nombre simple con espacio - separado por punto', async () => {
    const result = await normalize('Juan Lema');
    expect(result).toBe('juan.lema');
  });

  test('NU-02 | Tildes diacríticas removidas', async () => {
    const result = await normalize('Ángela García');
    expect(result).toBe('angela.garcia');
  });

  test('NU-03 | Letra ñ reemplazada por n', async () => {
    const result = await normalize('Nuñez Otoño');
    expect(result).toBe('nunez.otono');
  });

  test('NU-04 | Caracteres especiales eliminados', async () => {
    const result = await normalize('Pedro @ #!');
    expect(result).toBe('pedro');
  });

  test('NU-05 | Solo números permitidos', async () => {
    const result = await normalize('12345');
    expect(result).toBe('12345');
  });

  test('NU-06 | Mezcla de letras y números', async () => {
    const result = await normalize('User 42 test');
    expect(result).toBe('user.42.test');
  });

  test('NU-07 | Ya está en minúsculas y sin espacios', async () => {
    const result = await normalize('juanlema');
    expect(result).toBe('juanlema');
  });

});

describe('normalizeUsername — Casos Límite', () => {

  test('NU-08 | String vacío - retorna cadena vacía', async () => {
    const result = await normalize('');
    expect(result).toBe('');
  });

  test('NU-09 | Solo caracteres especiales - retorna vacío', async () => {
    const result = await normalize('@#!$%^&*');
    expect(result).toBe('');
  });

  test('NU-10 | Espacios múltiples entre palabras - un solo punto', async () => {
    const result = await normalize('  Pedro   López  ');
    expect(result).toBe('pedro.lopez');
  });

  test('NU-11 | Puntos dobles generados - colapsados en uno', async () => {
    const result = await normalize('pedro  lopez');
    expect(result).toBe('pedro.lopez');
  });

  test('NU-12 | Nombre de exactamente 60 caracteres - no se trunca', async () => {
    const name = 'a'.repeat(60);
    const result = await normalize(name);
    expect(result.length).toBe(60);
  });

  test('NU-13 | Nombre > 60 chars CON punto antes del límite - corta en punto', async () => {
    const name = 'pedro jesus garcia lopez hernandez perez mendoza sierra rivera';
    const result = await normalize(name);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).not.toMatch(/\.$/);
  });

  test('NU-14 | Nombre > 60 chars SIN punto - corta en 60 exacto', async () => {
    const name = 'a'.repeat(75);
    const result = await normalize(name);
    expect(result.length).toBe(60);
  });

  test('NU-15 | No debe empezar ni terminar en punto', async () => {
    const result = await normalize('  hola  ');
    expect(result).not.toMatch(/^\./);
    expect(result).not.toMatch(/\.$/);
  });

});

describe('normalizeUsername — Spies e Interacciones', () => {

  test('NU-16 | No se llama sails.log.error en ejecución exitosa', async () => {
    await normalize('Juan Perez');
    expect(sailsMock.log.error).not.toHaveBeenCalled();
  });

});
