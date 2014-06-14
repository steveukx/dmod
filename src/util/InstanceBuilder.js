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

    InstanceBuilder.Instance.prototype.save = function(onSave) {
        this.emit('save', this.__changed, onSave);
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
            Object.defineProperty(fieldsProto, column.key, {
                get: function () {
                    return this.__values[column.key];
                },
                set: function (value) {
                    if (this.__values[column.key] !== value) {
                        this.__values[column.key] = value;
                        this.__changed.indexOf(column.key) < 0 && this.__changed.push(column.key);
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
