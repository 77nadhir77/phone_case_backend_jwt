const sequelize = require('../database')
const { DataTypes } = require("sequelize");

const Order = sequelize.define('orders', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Paid', 'Cancelled'),
        defaultValue: 'Pending'
    },
    shippingStatus: {
        type: DataTypes.ENUM('awaiting shipping', 'fulfilled', 'shipped'),
        defaultValue: 'awaiting shipping'
    }
})

const PhoneCase = require('./PhoneCase')
const User = require('./User')

Order.belongsTo(User, {foreignKey: 'userId'})
User.hasMany(Order, {foreignKey: 'userId'})

Order.belongsTo(PhoneCase, {foreignKey: 'phoneCaseId'})
PhoneCase.hasOne(Order, {foreignKey: 'phoneCaseId'})

module.exports = Order