module.exports = {
  default: {
    paths: ['__tests__/acceptance/features/**/*.feature'],

    require: [
      '__tests__/acceptance/support/world.js',
      '__tests__/acceptance/step-definitions/**/*.steps.js',
    ],

    format: [
      'summary',
      'html:coverage/cucumber-report.html',
    ],

    timeout: 10000,
  },
};
