(function () {

    'use strict';

    module.exports = InstanceBuilder;

    var Q = require('q');
    var EventEmitter = require('events').EventEmitter;
    var camelCase = function (input, initialCap) {
        var output = input.toLowerCase().replace(/[^0-9a-z]+(.)/g, function (_, chr) {
            return chr.toUpperCase();
        });
        if (initialCap) {
            output = output.charAt(0).toUpperCase() + output.substr(1);
        }
        return output;
    };

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

            // populateField() => fetches the associated instance and sets it in this instance
            if (column.association) {
                proto['populate' + column.association.foreignTable] = function () {
                    var deferred = Q.defer();
                    var self = this;
                    self.emit('populate', column, function (result) {
                        self[column.key] = result;
                        deferred.resolve(self);
                    });
                    return deferred.promise;
                };
            }
        });
    }

    InstanceBuilder.Instance = function () {
        EventEmitter.call(this);
    };
    require('util').inherits(InstanceBuilder.Instance, EventEmitter);

    /**
     * Populates any named field associations, resolved with the current instance once all associations are populated.
     *
     * @returns {Q.promise}
     */
    InstanceBuilder.Instance.prototype.populate = function() {
        var instance = this;
        var promises = [].map.call(arguments, function (fieldName) {
            var populateFn = 'populate' + camelCase(fieldName, true);
            if (!instance[populateFn]) {
                throw new ReferenceError("Cannot populate field " + fieldName + ", not an associated field");
            }
            return instance[populateFn]();
        });

        return Q.all(promises).then(function () {
            return instance;
        });
    };

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
     * Gets a flag showing whether there are pending changes
     * @returns {boolean}
     */
    InstanceBuilder.Instance.prototype.hasChanges = function() {
        for (var anything in this.__changed) {
            if (this.__changed.hasOwnProperty(anything)) {
                return true;
            }
        }
        return false;
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
