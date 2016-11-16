const RedisPool = require("simple-redis-pool");

const debug = require("debug")("simpleRedisStore");

var RedisStore = module.exports = function (name, redisOptions, poolOptions) {

  // set default pool options
  poolOptions = Object.assign({
    acquireTimeoutMillis: 50
  }, poolOptions || {});

  this.name = name;
  this.redisOptions = redisOptions;
  this.poolOptions = poolOptions;
  this.pool = new RedisPool(name, redisOptions, poolOptions);
  debug("Redis store created.", this.pool.status());

  this.getName = this.pool.getName;
  this.getRedisDB = this.pool.getRedisDB;
  this.getPoolStatus = this.pool.status;
};

RedisStore.prototype.executeCmd = function (cmd) {
  return this.pool.acquire()
    .then(conn => cmd(conn)
        .then(result => {
          this.pool.release(conn);
          return result;
        })
        .catch(err => {
          this.pool.release(conn);
          throw err;
        }));
};

RedisStore.prototype.get = function (key) {
  return this.executeCmd(conn => conn.getAsync(key));
};

RedisStore.prototype.set = function (key, value, ttlInSeconds) {

  if (ttlInSeconds) {
    return this.executeCmd(conn => conn.setexAsync(key, ttlInSeconds, value));
  } else {
    return this.executeCmd(conn => conn.setAsync(key, value));
  }
};

RedisStore.prototype.del = function (keys) {
  return this.executeCmd(conn => conn.delAsync(keys));
};

RedisStore.prototype.expire = function (key, ttlInSeconds) {
  return this.executeCmd(conn => conn.expireAsync(key, ttlInSeconds));
};

RedisStore.prototype.ttlInSeconds = function (key) {
  return this.executeCmd(conn => conn.ttlAsync(key));
};

RedisStore.prototype.keys = function (pattern) {
  if (!pattern || pattern === "") {
    pattern = "*";
  }

  return this.executeCmd(conn => conn.keysAsync(pattern));
};

RedisStore.prototype.deleteAll = function (pattern) {
  if (!pattern || pattern === "") {
    pattern = "*";
  }
  debug("clearing redis keys: ", pattern);

  return this.keys(pattern)
    .then(keys => {

      if (keys.length > 0) {
        debug("deleting keys ", keys);
        return this.del(keys);
      } else {
        debug("no keys exists with pattern: ", pattern);
        return Promise.resolve(true);
      }
    });
};
