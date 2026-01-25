module.exports = function asyncWrap (f) {
  return function (req, res, next) {
    f(req, res, next).catch(next);
  };
};
