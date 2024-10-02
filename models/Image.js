const sequelize = require('../database')
const { DataTypes } = require('sequelize')


const Image = sequelize.define('Images', 
  {
    filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mimetype: {
    type: DataTypes.STRING,
    allowNull: false
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}
)

const User = require('./User')
User.hasMany(Image, { foreignKey: 'userId'})
Image.belongsTo(User)

module.exports = Image