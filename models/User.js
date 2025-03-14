const sequelize = require('../database')
const { DataTypes } = require('sequelize')
const bcrypt = require('bcryptjs');




const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING, 
        allowNull: false, 
        uniqur: true,
        validate: {notEmpty:true}
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {notEmpty:true}
    },
    role: {
        type: DataTypes.ENUM('admin', 'user'),
        defaultValue: 'user'
    }
},
{
    timestamps: true,
    hooks: {
        beforeCreate: async (user) => {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        },
        beforeUpdate: async (user) => {
          if (user.changed('password')) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        },
      },
})


module.exports = User