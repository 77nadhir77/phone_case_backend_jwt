const { Sequelize } = require('sequelize')

  const sequelize = new Sequelize('phone_covers', 'root', '', {
    host: 'localhost',
    dialect:  'mysql',
  });


module.exports = sequelize