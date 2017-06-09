// Inspired by SciPy's ttest_ind function
// Implements Welch's T Test which can handle unequal variances
// m is the sample mean, v is the population variance, n the sample size
function tTest(m1, v1, n1, m2, v2, n2) {

  var vn1 = v1 / n1;
  var vn2 = v2 / n2;
  var df = Math.pow(vn1 + vn2, 2) / (Math.pow(vn1, 2) / (n1 - 1) + Math.pow(vn2, 2) / (n2 - 1));

  // If df is undefined, variances are zero (assumes n1 > 0 & n2 > 0).
  // Hence it doesn't matter what df is as long as it's not NaN.
  if (!df) {
    console.error("Somehow df is not defined");
    df = 1;
  }
  var denom = Math.sqrt(vn1 + vn2);

  var d = m1 - m2;
  var t = d/denom;
  // Returns the degrees of freedom and the T score
  return [df, t];
}

module.exports = tTest;
