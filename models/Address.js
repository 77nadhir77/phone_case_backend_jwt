const sequelize = require('../database')
const { DataTypes } = require('sequelize')



const Address = sequelize.define('Addresses', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  street: {
    type: DataTypes.STRING,
    allowNull: false
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true
  },
  zipcode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  }
})



const Order = require('./Order')
Order.belongsTo(Address, {foreignKey: 'addressId'})
Address.hasMany(Order, {foreignKey: 'addressId'})

module.exports = Address