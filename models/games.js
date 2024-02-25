'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class games extends Model {
    static associate(models) {
      games.belongsTo(models.User,{
        foreignKey:'userId'
      })
      // define association here
    }

    static addgames({ title, subtitle, date }) {
      return this.create({ title, subtitle, date });
    }

    static getgames() {
      return this.findAll();
    }

    static deleteGameById(id) {
      return this.destroy({ where: { id } });
    }
  }

  games.init(
    {
      title: DataTypes.STRING,
      subtitle: DataTypes.STRING,
      date: DataTypes.DATEONLY,
    },
    {
      sequelize,
      modelName: 'games',
    }
  );

  return games;
};

