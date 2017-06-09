source('common.R')

# upper.bound.of.mean = 10 # Determined by visual inspection
# upper.bound.of.sd = 10
max.deviation <- 10
limit = 150

aggregate.data <- function(stuff.to.parse, label.name, label.val) {
  # all.data.raw <- head(Filter(function(x) {return(x['mean'] < upper.bound.of.mean && x['sd'] < upper.bound.of.sd)}, lapply(stuff.to.parse, parse.data)),limit)
  all.data.raw.list <- lapply(stuff.to.parse, parse.data)
  all.data.raw <- do.call(rbind, lapply(all.data.raw.list, data.frame))
  # print("length(all.data.raw)")
  # print(length(all.data.raw))
  print("all.data.raw")
  print(all.data.raw)
  # stop()
  # all.summaries <- lapply(all.lists, function(item) {return(summary(item))})
  # print('all.summaries')
  # print(all.summaries)
  # all.summaries <- lapply(all.summaries, function(item) {item['sd'] <- sd(all.lists[[name]]); return(item)})
  # print('all.summaries')
  # print(all.summaries)
  # number.of.sds <- lapply(names(all.lists), function(name) {return( (all.lists[[name]]-all.summaries[[name]]['Mean'])/all.summaries[[name]]['sd'] )})
  # print('number.of.sds')
  # print("all.data.raw")
  # print(all.data.raw)
  filtered.list <<- lapply(all.data.raw, function(item) {
    if (class(item) != 'numeric') {
      return(rep(T, length(item)))
    }
    s <- summary(item)
    s['sd'] <- sd(item)
    print(item)
    print(s)
    if (s['sd']==0) {
      s['sd'] <- 1
    }
    return(
      (item-s['Mean'])/s['sd'] <= max.deviation
    )
  })
  # print('filtered.list')
  # print(filtered.list)
  # print(class(filtered.list))
  # print(lapply(filtered.list, function(item) {return(class(item))}))
  actual.filter <- Reduce(function(x,y) {return(x & y)}, filtered.list)
  # print('actual.filter')
  # print(actual.filter)
  print(paste0("dropped ", tail(head(which(actual.filter==T), limit), n=1)-limit))
  # print("all.data.raw")
  # print(all.data.raw)
  filtered.data <- lapply(all.data.raw, function(item) {return(item[actual.filter])})
  # print("filtered.data")
  # print(filtered.data)
  # stop()
  # print("str(filtered.data)")
  # print(str(filtered.data))
  all.data <- (data.frame(do.call(cbind.data.frame, filtered.data)))
  # all.data <- data.frame(filtered.data)
  # print("all.data as dataframe")
  # print(all.data)
  stopifnot(dim(all.data)[1] >= limit)
  all.data <- all.data[1:limit,]

  # print("all.data")
  # print(all.data)
  # print("summary(all.data)")
  # print(str(all.data))
  # print(summary(all.data))

  # quartz()
  # melt.all <- melt(all.data)
  # plot <- ggplot(data = melt.all, aes(x = value)) + #xlim(0, 10) +
  #   stat_density() +
  #   facet_wrap(~variable, scales = "free")
  # print(plot)

  all.data[label.name] <- label.val
  return(all.data)
}

# good.start <- as.POSIXct("2016-10-26 20:30:00 CEST")
# good.end <- as.POSIXct("2016-10-26 21:30:00 CEST")
# bad.start <- as.POSIXct("2016-10-26 14:15:00 CEST")
# bad.end <- as.POSIXct("2016-10-26 15:00:00 CEST")
# cross.start <- as.POSIXct("2016-11-03 12:20:00 CEST")
# cross.end <- as.POSIXct("2016-11-03 14:00:00 CEST")
# self.start <- as.POSIXct("2016-11-03 20:00:00 CEST")
# self.end <- as.POSIXct("2016-11-03 23:00:00 CEST")

chrome.good.new.start <- as.POSIXct("2016-11-29 16:00:00 CEST")
chrome.good.new.end <- as.POSIXct("2016-11-29 16:45:00 CEST")
ff.good.new.start <- as.POSIXct("2016-11-29 17:00:00 CEST")
ff.good.new.end <- as.POSIXct("2016-11-29 18:00:00 CEST")

chrome.load.new.start <- as.POSIXct("2016-12-01 14:45:00 CEST")
chrome.load.new.end <- as.POSIXct("2016-12-01 15:40:00 CEST")
ff.load.new.start <- as.POSIXct("2016-12-01 15:45:00 CEST")
ff.load.new.end <- as.POSIXct("2016-12-01 16:40:00 CEST")

chrome.bad.new.start <- as.POSIXct("2016-12-05 17:25:00 CEST")
chrome.bad.new.end <- as.POSIXct("2016-12-05 18:30:00 CEST")
ff.bad.new.start <- as.POSIXct("2016-12-05 18:45:00 CEST")
ff.bad.new.end <- as.POSIXct("2016-12-05 19:45:00 CEST")

chrome.cross.new.start <- as.POSIXct("2016-12-05 19:50:00 CEST")
chrome.cross.new.end <- as.POSIXct("2016-12-05 20:40:00 CEST")
ff.cross.new.start <- as.POSIXct("2016-12-05 20:50:00 CEST")
ff.cross.new.end <- as.POSIXct("2016-12-05 21:40:00 CEST")

# chrome.self.new.start <- as.POSIXct("2016-12-01 18:30:00 CEST")
# chrome.self.new.end <- as.POSIXct("2016-12-01 19:30:00 CEST")
# ff.self.new.start <- as.POSIXct("2016-12-01 15:45:00 CEST")
# ff.self.new.end <- as.POSIXct("2016-12-01 16:40:00 CEST")

# chrome.cross.new.start <- as.POSIXct("2016-12-02 13:50:00 CEST")
# chrome.cross.new.end <- as.POSIXct("2016-12-02 14:50:00 CEST")
# ff.cross.new.start <- as.POSIXct("2016-12-02 14:50:00 CEST")
# ff.cross.new.end <- as.POSIXct("2016-12-02 15:50:00 CEST")

dates = as.POSIXct(sapply(unlist(Sys.glob("rfiles/router-*.txt")), function(x) {return((as.numeric(str_extract(x, "[0-9]+"))/1000))}), origin="1970-01-01")

good.chrome = names(Filter(function(x) {return(x > chrome.good.new.start && x < chrome.good.new.end)}, dates))
good.ff = names(Filter(function(x) {return(x > ff.good.new.start && x < ff.good.new.end)}, dates))
# load.chrome = names(Filter(function(x) {return(x > chrome.load.new.start && x < chrome.load.new.end)}, dates))
# load.ff = names(Filter(function(x) {return(x > ff.load.new.start && x < ff.load.new.end)}, dates))
bad.chrome = names(Filter(function(x) {return(x > chrome.bad.new.start && x < chrome.bad.new.end)}, dates))
bad.ff = names(Filter(function(x) {return(x > ff.bad.new.start && x < ff.bad.new.end)}, dates))
cross.chrome = names(Filter(function(x) {return(x > chrome.cross.new.start && x < chrome.cross.new.end)}, dates))
cross.ff = names(Filter(function(x) {return(x > ff.cross.new.start && x < ff.cross.new.end)}, dates))


# bad = names(Filter(function(x) {return(x > bad.start && x < bad.end)}, dates))
# cross = names(Filter(function(x) {return(x > cross.start && x < cross.end)}, dates))
# self = names(Filter(function(x) {return(x > self.start && x < self.end)}, dates))

print('good')
good.data.chrome <- aggregate.data(good.chrome, 'wifi', factor("good"))
good.data.ff <- aggregate.data(good.chrome, 'wifi', factor("good"))

# print('load')
# load.data.chrome <- aggregate.data(load.chrome, 'wifi', factor("load"))
# load.data.ff <- aggregate.data(load.chrome, 'wifi', factor("load"))

print('bad')
bad.data.chrome <- aggregate.data(bad.chrome, 'wifi', factor("bad"))
bad.data.ff <- aggregate.data(bad.chrome, 'wifi', factor("bad"))

print('cross')
cross.data.chrome <- aggregate.data(cross.chrome, 'wifi', factor("cross"))
cross.data.ff <- aggregate.data(cross.chrome, 'wifi', factor("cross"))

# print('bad')
# bad.data <- aggregate.data(bad, 'wifi', factor("bad"))
# print('cross')
# cross.data <- aggregate.data(cross, 'wifi', factor("cross"))
# print('self')
# self.data <- aggregate.data(self, 'wifi', factor("self"))

# stop()

# all.data <- data.frame(rbind(good.data, bad.data, cross.data, self.data))
all.data <- data.frame(rbind(good.data.chrome, good.data.ff, load.data.chrome, load.data.ff, bad.data.chrome, bad.data.ff, cross.data.chrome, cross.data.ff))
# print(all.data)

library(caret)
library(doMC)
registerDoMC(cores = 4)

# # Filter correlated features
# highlyCor <- findCorrelation(cor(all.data[1:(ncol(all.data)-1)]), cutoff = 0.9)
# all.data <- all.data[,-highlyCor]

# # Preprocess
# pp <- preProcess(all.data[1:(ncol(all.data)-1)],
#                  method = c("center", "scale", "YeoJohnson", "nzv"))
# print(pp)
# all.data <- predict(pp, newdata = all.data)

# # Print full plot
# quartz()
# library(AppliedPredictiveModeling)
# transparentTheme(trans = .4)
# library(caret)
# library(ellipse)
# featurePlot(x = all.data[, 1:(ncol(all.data)-1)],
#             y = all.data$wifi,
#             plot = "ellipse",
#             ## Add a key at the top
#             auto.key = list(columns = nrow(unique(all.data[ncol(all.data)]))))

# Cross validation
set.seed(1)
inTraining <- createDataPartition(all.data$wifi, p = .75, list = FALSE)
training <- all.data[ inTraining,]
testing  <- all.data[-inTraining,]
fitControl <- trainControl(## 10-fold CV
                           method = "repeatedcv",
                           number = 10,
                           ## repeated ten times
                           repeats = 10)
# library(gbm)
# gbmFit1 <- train(wifi ~ ., data = training,
#                 method = "gbm",
#                 trControl = fitControl,
#                 ## This last option is actually one
#                 ## for gbm() that passes through
#                 verbose = FALSE
#                 # preProcess = c("center", "scale", "YeoJohnson", "nzv", "ica")
#                 )
# print(gbmFit1)
# library(randomForest)
# rfFit1 <- train(wifi ~ ., data = training,
#                 method = "rf",
#                 # ntree = 64,
#                 trControl = fitControl,
#                 ## This last option is actually one
#                 ## for gbm() that passes through
#                 verbose = FALSE
#                 # preProcess = c("center", "scale", "YeoJohnson", "nzv", "ica")
#                 )
# print(rfFit1)
# library(e1071)
# svmFit1 <- train(wifi ~ ., data = training,
#                 method = "svmLinear2",
#                 # ntree = 64,
#                 trControl = fitControl,
#                 ## This last option is actually one
#                 ## for gbm() that passes through
#                 verbose = FALSE
#                 # preProcess = c("center", "scale", "YeoJohnson", "nzv", "ica")
#                 )
# print(svmFit1)

subsets <- c(1:(ncol(all.data)-1))
ctrl <- rfeControl(functions = rfFuncs,
                   method = "repeatedcv",
                   repeats = 5,
                   verbose = FALSE)

x <- as.data.frame(training[1:(ncol(all.data)-1)])
y <- training$wifi
rfProfile <- rfe(x, y,
                 sizes = subsets,
                 rfeControl = ctrl)

print("Finished!")
print(rfProfile)
saveRDS(rfProfile$fit, "trainedRF2.rds")

# Confusion Matrix stuff

print.confusion.matrix <- function() {
  predicted <- predict(rfProfile$fit, testing)
  cm <- confusionMatrix(data = predicted, reference = testing$wifi)
  print(cm)
}


# m <- svm(wifi~highest.peak+entropy, all.data)
# print(summary(m))
#
# # quartz()
#
# png(filename = "rplots/svm_self_cross_highestpeak_mad.png", width = 1000, height = 1000, units = 'px')
# plot(m, all.data, highest.peak~entropy)
# dev.off()
