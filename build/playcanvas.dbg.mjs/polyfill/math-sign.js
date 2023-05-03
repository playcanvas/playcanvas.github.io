// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sign#Polyfill
if (!Math.sign) {
  Math.sign = function (x) {
    // If x is NaN, the result is NaN.
    // If x is -0, the result is -0.
    // If x is +0, the result is +0.
    // If x is negative and not -0, the result is -1.
    // If x is positive and not +0, the result is +1.
    return (x > 0) - (x < 0) || +x;
    // A more aesthetic pseudo-representation:
    //
    // ( (x > 0) ? 1 : 0 )  // if x is positive, then positive one
    //          +           // else (because you can't be both - and +)
    // ( (x < 0) ? -1 : 0 ) // if x is negative, then negative one
    //         ||           // if x is 0, -0, or NaN, or not a number,
    //         +x           // then the result will be x, (or) if x is
    //                      // not a number, then x converts to number
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0aC1zaWduLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcG9seWZpbGwvbWF0aC1zaWduLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL01hdGgvc2lnbiNQb2x5ZmlsbFxuaWYgKCFNYXRoLnNpZ24pIHtcbiAgICBNYXRoLnNpZ24gPSBmdW5jdGlvbih4KSB7XG4gICAgICAgIC8vIElmIHggaXMgTmFOLCB0aGUgcmVzdWx0IGlzIE5hTi5cbiAgICAgICAgLy8gSWYgeCBpcyAtMCwgdGhlIHJlc3VsdCBpcyAtMC5cbiAgICAgICAgLy8gSWYgeCBpcyArMCwgdGhlIHJlc3VsdCBpcyArMC5cbiAgICAgICAgLy8gSWYgeCBpcyBuZWdhdGl2ZSBhbmQgbm90IC0wLCB0aGUgcmVzdWx0IGlzIC0xLlxuICAgICAgICAvLyBJZiB4IGlzIHBvc2l0aXZlIGFuZCBub3QgKzAsIHRoZSByZXN1bHQgaXMgKzEuXG4gICAgICAgIHJldHVybiAoKHggPiAwKSAtICh4IDwgMCkpIHx8ICt4O1xuICAgICAgICAvLyBBIG1vcmUgYWVzdGhldGljIHBzZXVkby1yZXByZXNlbnRhdGlvbjpcbiAgICAgICAgLy9cbiAgICAgICAgLy8gKCAoeCA+IDApID8gMSA6IDAgKSAgLy8gaWYgeCBpcyBwb3NpdGl2ZSwgdGhlbiBwb3NpdGl2ZSBvbmVcbiAgICAgICAgLy8gICAgICAgICAgKyAgICAgICAgICAgLy8gZWxzZSAoYmVjYXVzZSB5b3UgY2FuJ3QgYmUgYm90aCAtIGFuZCArKVxuICAgICAgICAvLyAoICh4IDwgMCkgPyAtMSA6IDAgKSAvLyBpZiB4IGlzIG5lZ2F0aXZlLCB0aGVuIG5lZ2F0aXZlIG9uZVxuICAgICAgICAvLyAgICAgICAgIHx8ICAgICAgICAgICAvLyBpZiB4IGlzIDAsIC0wLCBvciBOYU4sIG9yIG5vdCBhIG51bWJlcixcbiAgICAgICAgLy8gICAgICAgICAreCAgICAgICAgICAgLy8gdGhlbiB0aGUgcmVzdWx0IHdpbGwgYmUgeCwgKG9yKSBpZiB4IGlzXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgIC8vIG5vdCBhIG51bWJlciwgdGhlbiB4IGNvbnZlcnRzIHRvIG51bWJlclxuICAgIH07XG59XG4iXSwibmFtZXMiOlsiTWF0aCIsInNpZ24iLCJ4Il0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBLElBQUksQ0FBQ0EsSUFBSSxDQUFDQyxJQUFJLEVBQUU7QUFDWkQsRUFBQUEsSUFBSSxDQUFDQyxJQUFJLEdBQUcsVUFBU0MsQ0FBQyxFQUFFO0FBQ3BCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDQSxPQUFRLENBQUNBLENBQUMsR0FBRyxDQUFDLEtBQUtBLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSyxDQUFDQSxDQUFDLENBQUE7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtHQUNILENBQUE7QUFDTCJ9
