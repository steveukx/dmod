(function() {

    'use strict';

    module.exports = DMod;

    /**
     *
     * @constructor
     * @name DMod
     */
    function DMod(dataAdapter) {
        this._adapter = dataAdapter;
        this._models = {};
    }

    /**
     * Registers any number of tables supplied as instances of `DMod.Model`.
     *
     * @returns {DMod}
     */
    DMod.prototype.register = function() {
        [].forEach.call(arguments, function (table) {
            this._models[table.tableName] = table;
            this._adapter.create(table);

            this['create' + table.name] = this.create.bind(this, table);
        }, this);

        Object.keys(this._models).forEach(function (tableName) {
            this[tableName].associate(this);
        }, this._models);

        return this;
    };

    /**
     * Creates an instance of the supplied model, optionally with the data provided. When the data includes a value
     * for the primary key field, it is assumed that changes in the record should update in the database (duplicates
     * will be overwrite existing records).
     *
     * When no data (or no data for the primary key field) is supplied, a new record is created by saving the instance,
     * and a new ID will be generated.
     *
     * @param {DMod.Model} model
     * @param {Object} [withData]
     * @return {DMod.Instance}
     */
    DMod.prototype.create = function(model, withData) {
        return model.create(withData);
    };

    /**
     * Creates and returns a new table with the given name, if the descriptor is supplied as a string it is used as the
     * path to a file that exports this model (must export an instance of `DMod.Model`) or it can be a `DMod.Model`
     * instance.
     *
     * @param {string} tableName
     * @param {string} [descriptor]
     * @returns {DMod.Model}
     */
    DMod.Table = function(tableName, descriptor) {
        var table;
        if (typeof descriptor === "string") {
            table = require(descriptor);
        }
        else {
            table = new DMod.Model(tableName);
        }

        if (!(table instanceof DMod.Model)) {
            throw new TypeError("Table `" + tableName + "` must be an instance of the DMod.Model");
        }

        return table;
    };

    DMod.Model = require('./Model');
    DMod.adapters = require('./adapters/index');

}());
