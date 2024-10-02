const sequelize = require('../database')
const { DataTypes } = require('sequelize')



const RefreshToken = sequelize.define(
    'RefreshToken', 
    {
        token: { 
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        expiryDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM("valid", "invalid"),
            defaultValue: "valid"
        } 
    },{
        tableName: "refreshTokens_blacklist"
    })

const User = require('./User')
User.hasMany(RefreshToken, { foreignKey: 'userId' });
RefreshToken.belongsTo(User);



module.exports = RefreshToken