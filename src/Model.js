
(function () {

    var ForeignKeyConstraint = require('./sql/ForeignKeyConstraint');
    var ColumnDefinition = require('./sql/ColumnDefinition');
    var ColumnsStore = require('./sql/ColumnsStore');
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
        this._name = name;
        this._associations = [];
        this._fields = {};
        this.columnsStore = new ColumnsStore;
    }

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

        return this._Instance(data || {});



        var fields = Object.keys(this._fields).map(function (field) { return this[field]; }, this._fields);
        var values = {};
        var object = {};

        Object.defineProperties(object, fields.reduce(function (properties, field) {

            console.log('Model#create', field);
            var fieldName = field.key;
            values[fieldName] = field.hasOwnProperty('defaultValue') ? field.defaultValue : null;
            properties[fieldName] = {
                get: function () {
                    return values[fieldName];
                },
                set: function (value) {
                    values[fieldName] = value;
                }
            };
            return properties;
        }, {}));

        if (data) {
            fields.forEach(function (field) {
                if (data.hasOwnProperty(field.key)) {
                    object[fieldName] = data[fieldName];
                }
            });
        }

        return object;
    };

}());
