library(ggplot2)
library(pastecs)
library(moments)
library(reshape2)
library(stringr)
library(entropy)

size.of.one.sample = 250;

parse.data <- function(data, os, browser) {
  if (class(data)=="character") {
    if (grepl("/", data)) {
      # print("Has /")
      new.name <- as.POSIXct((as.numeric(str_extract(data, "[0-9]+"))/1000), origin="1970-01-01")
      new.name <- paste('rplots/router-',new.name,'.png', sep="")
      dashes <- gregexpr('-', data)[[1]]
      os <- substr(data, dashes[1]+1, dashes[2]-1)
      browser <- substr(data, dashes[2]+1, dashes[3]-1)
      data <- scan(data, quiet=T)
    } else {
      print("parsing from JSON")
      library(jsonlite)
      data <- as.numeric(fromJSON(data))
    }
  }
  packet.loss = size.of.one.sample - length(data)
  # print("data")
  # print(data)

  s <- summary(data)
  # print("s")
  # print(s)

  sd <- sd(data)

  # Histogram
  bin.width <- 0.1
  num.bins <- ceiling(max(data)/0.1)

  # Density
  d = density(data, adjust = 1)

  # Maxima
  ts_y<-ts(d$y)
  tp<-turnpoints(ts_y)
  filtered = extract(tp, no.tp = FALSE, peak = TRUE, pit = FALSE)
  filtered[d$y < 0.01] = FALSE

  # print('as is', ms)
  # print('str', str(ms))
  # normalized.interquartile.range <- (s[["3rd Qu."]]-s[["1st Qu."]])/s[["Median"]]
  coefficient.of.variation <- sd/s[["Median"]]

  ms <- all.moments(data, order.max = 3, central = T)
  skewness = ms[3]
  kurtosis = ms[4]
  # num.of.peaks <- sum(filtered)
  highest.peak <- max(d$y[filtered])
  # highest.peak.pos <- d$x[which(d$y == highest.peak)]
  mad <- mad(data)
  mm = mad/s[['Median']]
  sdm = sd/s[['Mean']]

  # print(data)
  # print(str(d))
  ent <- entropy(discretize(data, num.bins, c(0, max(data))))
  # print(ent)
  # print(entod)

  # highest.peak, mad, sd, skewness, kurtosis
  metrics = list(
    s[['Mean']],
    s[['Median']],
    mad,
    packet.loss,
    mm,
    sd,
    sdm,
    highest.peak,
    skewness,
    kurtosis,
    ent,
    os,
    browser
  )
  names(metrics) = c(
    "mean",
    "median",
    "mad",
    "packet.loss",
    "mm",
    "sd",
    "sdm",
    "highest.peak",
    "skewness",
    "kurtosis",
    "entropy",
    "os",
    "browser"
  )

  png(filename = new.name, width = 1000, height = 1000, units = 'px')
  hist(data, labels=FALSE, main="", xlab="", breaks=num.bins, prob=TRUE)
  lines(d, col="blue", lwd=5)
  lines(d$x[filtered],d$y[filtered],type="h",col="red", lwd=5)
  dev.off()

  # All datapoints
  # lines(data,rep(max(d$y), length(data)),type="h",col="green", lwd=1)

  return(metrics)
}
