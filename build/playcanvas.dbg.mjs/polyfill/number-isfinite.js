// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite#polyfill
if (Number.isFinite === undefined) Number.isFinite = function (value) {
  return typeof value === 'number' && isFinite(value);
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibnVtYmVyLWlzZmluaXRlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcG9seWZpbGwvbnVtYmVyLWlzZmluaXRlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL051bWJlci9pc0Zpbml0ZSNwb2x5ZmlsbFxuaWYgKE51bWJlci5pc0Zpbml0ZSA9PT0gdW5kZWZpbmVkKSBOdW1iZXIuaXNGaW5pdGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIGlzRmluaXRlKHZhbHVlKTtcbn1cbiJdLCJuYW1lcyI6WyJOdW1iZXIiLCJpc0Zpbml0ZSIsInVuZGVmaW5lZCIsInZhbHVlIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBLElBQUlBLE1BQU0sQ0FBQ0MsUUFBUSxLQUFLQyxTQUFTLEVBQUVGLE1BQU0sQ0FBQ0MsUUFBUSxHQUFHLFVBQVNFLEtBQUssRUFBRTtFQUNqRSxPQUFPLE9BQU9BLEtBQUssS0FBSyxRQUFRLElBQUlGLFFBQVEsQ0FBQ0UsS0FBSyxDQUFDLENBQUE7QUFDdkQsQ0FBQyJ9
