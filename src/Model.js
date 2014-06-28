
(function () {

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
                columnDefinition.association.model(models[columnDefinition.association.foreignTable]);
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
     */
    Model.prototype.find = function (id) {
        return this.by({id: id});
    };

    /**
     * Finds any number of items using the given search criteria
     * @param {object} search
     */
    Model.prototype.by = function(search) {
        var tokens = [];
        var columns = this.columnsStore;
        var criteria = Object.keys(search).map(function (fieldName) {
            if (!columns.exists(fieldName)) {
                throw new ReferenceError("Unknown field in query: " + fieldName);
            }

            var columnDefinition = columns.get(fieldName);
            tokens.push(search[fieldName]);
            if (columnDefinition.association) {
                return merge('`%s`.`id` = ?', fieldName);
            }
            else {
                return merge('`%s` = ?', fieldName);
            }
        }).join(', ');

        this._database.run(merge('SELECT * FROM `%s` where %s', this.tableName, criteria || 1), tokens);
    };

    Model.prototype.create = function(data) {
        if (!this._instanceFactory) {
            this._instanceFactory = new InstanceBuilder(this.columnsStore);
        }

        var model = this;
        return this._instanceFactory.create(data || {}).on('save', function (changes, onSave) {
            model.emit('save', this, changes, onSave);
        });
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

}());
