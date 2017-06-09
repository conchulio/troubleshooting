'use strict';
module.exports = function(sequelize, DataTypes) {
  var Result = sequelize.define('Result', {
    rtt: DataTypes.DOUBLE,
    os: DataTypes.STRING,
    browser: DataTypes.STRING,
    target: DataTypes.STRING,
    date: DataTypes.DATE,
    socketId: DataTypes.INTEGER,
    targetSocketId: DataTypes.INTEGER,
    measurementRunId: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Result;
};
