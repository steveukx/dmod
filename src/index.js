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
        }, this);

        Object.keys(this._models).forEach(function (tableName) {
            this[tableName].associate(this);
        }, this._models);

        return this;
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
