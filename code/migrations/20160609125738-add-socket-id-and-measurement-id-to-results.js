'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.addColumn(
      'Results',
      'socketId',
      {
        type: Sequelize.INTEGER,
      }
    ).then(function() {
      return queryInterface.addColumn(
        'Results',
        'targetSocketId',
        {
          type: Sequelize.INTEGER,
        }
      );
    }).then(function() {
      return queryInterface.addColumn(
        'Results',
        'measurementRunId',
        {
          type: Sequelize.INTEGER
        }
      );
    }).then(function() {
      queryInterface.sequelize.query('CREATE SEQUENCE "Results_measurementRunId_seq";');
    });
  },

  down: function (queryInterface, Sequelize) {
    queryInterface.removeColumn(
      'Results',
      'socketId'
    ).then(function() {
      return queryInterface.removeColumn(
        'Results',
        'targetSocketId'
      );
    }).then(function() {
      return queryInterface.removeColumn(
        'Results',
        'measurementRunId'
      );
    }).then(function() {
      queryInterface.sequelize.query('DROP SEQUENCE "Results_measurementRunId_seq";');
    });
  }
};
