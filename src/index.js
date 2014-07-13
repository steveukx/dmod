(function() {

    'use strict';

    module.exports = DMod;

    var Q = require('q');
    var EventEmitter = require('events').EventEmitter;

    /**
     *
     * @constructor
     * @name DMod
     */
    function DMod(dataAdapter) {
        EventEmitter.call(this);

        this._adapter = dataAdapter;
        this._models = {};
    }
    require('util').inherits(DMod, EventEmitter);

    /**
     * Adds a function handler to be called when any models currently being registered have finished being set up.
     * @param {Function} fn
     * @returns {DMod}
     */
    DMod.prototype.onReady = function(fn) {
        return this.on('ready', fn);
    };

    /**
     * Registers any number of tables supplied as instances of `DMod.Model` by either supplying model instances
     * as varargs or as a single array of models.
     *
     * @returns {DMod}
     */
    DMod.prototype.register = function() {
        var models = arguments.length === 1 && Array.isArray(arguments[0]) ? arguments[0] : arguments;
        var promises = [].map.call(models, this._registerModel, this);

        Q.all(promises).then(this.emit.bind(this, 'ready'));

        Object.keys(this._models).forEach(function (tableName) {
            this[tableName].associate(this);
        }, this._models);

        return this;
    };

    /**
     * Registers the supplied model, returns the same instance with any modifications made by the persistence adapter.
     *
     * @param {DMod.Model} model
     * @returns {DMod.Model}
     */
    DMod.prototype._registerModel = function(model) {
        this._models[model.tableName] = model;
        this['create' + model.name] = this.create.bind(this, model);

        this['find' + model.name] = model.find.bind(model);
        this['find' + model.name + 'ById'] = model.id.bind(model);

        model.on('create',  this._adapter.createRecord.bind(this._adapter, model));
        model.on('update',  this._adapter.updateRecord.bind(this._adapter, model));
        model.on('one',     this._adapter.findRecord.bind(this._adapter, model));
        model.on('all',     this._adapter.findRecords.bind(this._adapter, model));

        return this._adapter.create(model);
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
