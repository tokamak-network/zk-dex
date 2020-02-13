module.exports = function asyncWrap (f) {
  return function (res, req, next) {
    f(res, req, next).catch(next);
  };
};
