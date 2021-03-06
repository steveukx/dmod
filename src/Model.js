
(function () {

    var Q = require('q');
    var ForeignKeyConstraint = require('./sql/ForeignKeyConstraint');
    var ColumnDefinition = require('./sql/ColumnDefinition');
    var ColumnsStore = require('./sql/ColumnsStore');
    var InstanceBuilder = require('./util/InstanceBuilder');
    var EventEmitter = require('events').EventEmitter;
    var merge = require('util').format;

    module.exports = Model;

    /**
     * The Model is a convenience wrapper for creating a model and binding it to others.
     *
     * @param {String} name The name of the Model
     * @name {DMod.Model}
     * @constructor
     */
    function Model(name) {
        EventEmitter.call(this);
        this._name = name;
        this._associations = [];
        this._fields = {};
        this.columnsStore = new ColumnsStore;
    }
    require('util').inherits(Model, EventEmitter);

    /**
     * @type {Database}
     */
    Model.prototype._database = null;

    /**
     * @type {String} The name of the Model
     */
    Model.prototype._name = null;

    /**
     * @type {Object[]} The array of associations to create between this and other models
     */
    Model.prototype._associations = null;

    /**
     * @type {string[]} The array of field key names to use to generate a unique key for a record in this Model
     */
    Model.prototype._keyField = null;

    /**
     * @type {ColumnsStore} The set of columns (fields) in this Model
     * @name {DMod.Model#columnsStore}
     */
    Model.prototype.columnsStore = null;

    /**
     * Creates a field with any arbitrary configuration
     *
     * @param {String} name
     * @param {Object} config
     */
    Model.prototype.field = function(name, config) {
        config = config || {};
        var columnDefinition = this.columnsStore.add(new ColumnDefinition(name));

        for (var property in config) {
            columnDefinition[property] = config[property];
        }

        if (columnDefinition.autoIncrement) {
            this._keyField = [columnDefinition.key];
        }

        return this;
    };

    /**
     * Creates a field that is an auto-incrementing primary key field
     *
     * @param {String} name
     */
    Model.prototype.autoIncrementField = function(name) {
        return this.field(name, {type: "INTEGER", primaryKey: true, autoIncrement: true});
    };

    /**
     * Creates a field with a unique constraint.
     *
     * @param {String} name
     * @param {String} [type=STRING]
     * @param {String} [group]
     */
    Model.prototype.uniqueField = function(name, type, group) {
        if (arguments.length === 1) {
            group = "_" + name;
        }
        if (arguments.length === 2 && type.toUpperCase() !== type) {
            group = type;
            type = null;
        }

        return this.field(name, {type: type || "STRING", unique: group || true});
    };

    /**
     * Adds a unique constraint across all named fields supplied as varargs.
     * @returns {Model}
     */
    Model.prototype.uniqueConstraint = function() {
        var group = [].join.call(arguments, "_").replace(/[^a-zA-Z0-9]/g, '');
        [].forEach.call(arguments, function (fieldName) {
            var field = this.columnsStore.get(fieldName);
            if (!field) {
                throw "Unable to add a unique constraint to field " + fieldName + " - it is not yet in this Model";
            }
            if (field.unique) {
                throw "Unable to add a unique constraint to field " + fieldName + " - it is already constrained as " + field.unique;
            }
            field.unique = group;
        }, this);
        return this;
    };

    /**
     * Creates a named numeric field
     *
     * @param {String} name
     */
    Model.prototype.numericField = function(name) {
        return this.field(name, {type: "DECIMAL"});
    };

    /**
     * Creates a named numeric field
     *
     * @param {String} name
     */
    Model.prototype.dateTimeField = function(name) {
        return this.field(name, {type: "DATETIME"});
    };

    /**
     * Associates this model with another where this model will have one or more of the other named model instances.
     *
     * @param {String} modelName The name of the associated model
     * @param {String} [named] The name to use to reference the associated models
     */
    Model.prototype.hasOne = function(modelName, named) {
        var foreignKeyConstraint = new ForeignKeyConstraint(modelName, named || modelName, modelName);

        this._associations.push(foreignKeyConstraint);
        return this.field(foreignKeyConstraint.fieldName, {
            type: 'INTEGER',
            defaultValue: null,
            association: foreignKeyConstraint
        });
    };

    /**
     * Called by the model manager, allows reverse referencing all other models in the application
     * @param models
     * @returns {Model}
     */
    Model.prototype.associate = function(models) {
        this.columnsStore.forEach(function (columnDefinition) {
            if (columnDefinition.association) {
                columnDefinition.association.model(
                    models[columnDefinition.association.foreignTable.toLowerCase() + 's']);
            }
        });
        return this;
    };

    /**
     * Name of the model for use when describing it in a data store.
     *
     * @type {string} tableName
     * @name DMod.Model#tableName
     */
    Object.defineProperties(Model.prototype, {
        tableName: {
            get: function () {
                return this._name.toLowerCase().replace(/s$/, '') + 's';
            }
        },
        name: {
            get: function () {
                return this._name.toLowerCase().replace(/^./, function (char) {
                    return char.toUpperCase();
                });
            }
        }
    });

    /**
     * Finds the item with the supplied ID.
     * @param {string|number} id
     * @return {Q.promise}
     */
    Model.prototype.id = function (id) {
        return this.find({id: id}).then(function (rows) {
            return rows[0] || null;
        });
    };

    /**
     * Finds any number of items using the given search criteria
     * @param {object} search
     * @return {Q.promise}
     */
    Model.prototype.find = function(search) {
        var model = this;
        var columns = this.columnsStore;
        var criteria = Object.keys(search).reduce(function (criteria, fieldName) {
            if (!columns.exists(fieldName)) {
                throw new ReferenceError("Unknown field in query: " + fieldName);
            }

            criteria[fieldName] = search[fieldName];
            return criteria;
        }, {});

        var deferred = Q.defer();
        this.emit('all', criteria, function (err, res) {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve([].concat(res).map(function (data) {
                    return model._build(data, Model.UPDATE_EVENT).commitChanges();
                }));
            }
        });
        return deferred.promise;
    };

    /**
     * Creates a new instance of this model, the first save will emit the `onSaveEvent` event, thereafter it will be
     * an update.
     *
     * @param {Object} data
     * @param {string} onSaveEvent
     * @returns {Object}
     */
    Model.prototype._build = function(data, onSaveEvent) {
        if (!this._instanceFactory) {
            this._instanceFactory = new InstanceBuilder(this.columnsStore);
        }

        var model = this;
        var event = onSaveEvent;

        return this._instanceFactory.create(data).on('save', function (changes, onSave) {
            model.emit(event, this, changes, onSave);
            this.commitChanges();
            event = Model.UPDATE_EVENT;
        });
    };

    /**
     * Creates a new instance of this model (optionally with the supplied data). Saving a model created in this way
     * is deemed to always be inserting a new model to the store.
     *
     * @param {Object} [data]
     * @returns {Object}
     */
    Model.prototype.create = function(data) {
        return this._build(data || {}, Model.CREATE_EVENT);
    };

    /**
     * Gets the array of field names to use to generate a unique key for a model of this type
     * @returns {string[]}
     */
    Model.prototype.getUniqueFields = function() {
        if (!this._keyField) {
            this._keyField = this.columnsStore.get().filter(function (columnDefinition) {
                return columnDefinition.unique;
            }).map(function (columnDefinition) {
                return columnDefinition.key;
            });
        }

        return this._keyField;
    };

    Model.UPDATE_EVENT = 'update';

    Model.CREATE_EVENT = 'create';

}());
