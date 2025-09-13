var morgan = require('morgan');

module.exports = function requestLog(sails) {
  return {
    defaults: {
      requestlogger: {
        format: 'dev',
        inDevelopment: true,
        inProduction: false,
      },
    },

    routes: {
      before: {
        'ALL /*': function addRequestLogging(req, res, next) {
          sails.log.verbose('\n\nRequestLogger hook is running! request path -------> ');
          var loggerSettings = sails.config['requestlogger'];
          var isProduction = process.env.NODE_ENV === 'production';

          if (
            (isProduction && loggerSettings.inProduction === true) ||
            (!isProduction && loggerSettings.inDevelopment === true)
          ) {
            var logger = morgan(loggerSettings.format);
            logger(req, res, (err) => {
              if (err) {
                return next(err);
              }

              next();
            });
          } else {
            return next();
          }
        },
      },
    },

    /**
     * Initialize the hook
     * @param  {Function} cb Callback for when we're done initializing
     */
    initialize: function (cb) {
      sails.log.verbose('cb addRequestLogging');
      cb();
    },
  };
};