(function () {

    'use strict';

    module.exports = InstanceBuilder;

    var EventEmitter = require('events').EventEmitter;

    /**
     *
     * @param {ColumnsStore} columnsStore
     * @constructor
     */
    function InstanceBuilder (columnsStore) {
        var proto = this._fields = {};

        columnsStore.forEach(function (column) {
            var key = column.key;

            proto[column.key] = {
                get: function () {
                    return this.__values[key];
                },
                set: function (val) {
                    if (this.__values[key] !== val) {
                        this.__changed[key] = val;
                        this.__values[key] = val;
                    }
                },
                configurable: false,
                enumerable: true
            };
        });
    }

    InstanceBuilder.Instance = function () {
        EventEmitter.call(this);
    };
    require('util').inherits(InstanceBuilder.Instance, EventEmitter);

    /**
     * Saves any changes made to the current model instance, the onSave handler will be called when persisting
     * the changes is complete.
     *
     * @param {Function} onSave
     * @returns {InstanceBuilder.Instance}
     */
    InstanceBuilder.Instance.prototype.save = function(onSave) {
        this.emit('save', this.__changed, onSave);
        return this;
    };

    /**
     * Returns the raw value object to be serialised as JSON
     * @returns {Object}
     */
    InstanceBuilder.Instance.prototype.toJSON = function() {
        return this.__values;
    };

    /**
     * Gets the original value of a field before any modifications were made to it.
     * @param {string} fieldName
     */
    InstanceBuilder.Instance.prototype.originalValue = function(fieldName) {
        return this.__original.hasOwnProperty(fieldName) ? this.__original[fieldName] : this.__values[fieldName];
    };

    /**
     * Marks all changes as having been set in the persistence store
     */
    InstanceBuilder.Instance.prototype.commitChanges = function() {
        var originalValues = this.__original;
        var changedValues = this.__changed;

        Object.keys(originalValues).forEach(function (key) {
            delete originalValues[key];
        });

        Object.keys(changedValues).forEach(function (key) {
            delete changedValues[key];
        });

        return this;
    };

    InstanceBuilder.prototype.create = function(values) {
        var instance = Object.create(Object.create(new InstanceBuilder.Instance(), {
            __values: {
                enumerable: false,
                configurable: false,
                value: {}
            },
            __changed: {
                enumerable: false,
                configurable: false,
                value: {}
            },
            __original: {
                enumerable: false,
                configurable: false,
                value: {}
            }
        }), this._fields);

        if (values) {
            for (var key in values) {
                if (this._fields.hasOwnProperty(key)) {
                    instance[key] = values[key];
                    delete instance.__changed[key];
                }
            }
        }

        return instance;
    };

    /**
     * @type {object} The property definition of all fields for the instance
     */
    InstanceBuilder.prototype._fields = null;

    // TODO: non-enumerable for values and changed
    InstanceBuilder.fromColumnsStore = function (columnStore) {
        var fieldsProto = {};

        columnStore.forEach(function (column) {
            var key = column.key;
            Object.defineProperty(fieldsProto, key, {
                get: function () {
                    return this.__values[key];
                },
                set: function (value) {
                    if (!this.__original.hasOwnProperty(key)) {
                        this.__original[key] = this.__values[key];
                    }
                    if (this.__values[key] !== value) {
                        this.__values[key] = value;
                        this.__changed.indexOf(key) < 0 && this.__changed.push(key);
                    }
                }
            });
        });

        return function (values) {
            var instance = new InstanceBuilder();
            instance.__proto__ = Object.create(fieldsProto);
            if (values) {
                for (var key in values) {
                    if (fieldsProto.hasOwnProperty(key)) {
                        instance.__values[key] = values[key];
                    }
                }
            }
            return instance;
        };
    };

}());
