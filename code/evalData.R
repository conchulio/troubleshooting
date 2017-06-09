library(caret)
library(randomForest)
library(doMC)
library(jsonlite)
registerDoMC(cores = 8)

dir <- "~/max/troubleshooting-magic/code"

source(paste(dir, 'common.R', sep="/"))

print("In evalData script")
model <- readRDS(file = paste(dir, "trainedRF.rds", sep="/"))

getClassProbabilities <- function(data) {
  features <- data.frame(parse.data(data))
  result <- predict(model, t(features)[,names(model$forest$ncat)], 'prob')
  niceResult <- toJSON(as.list(result[1,]))
  # print(jsonResult)
  # return(as.character(jsonResult))
  return(as.character(niceResult))
}

# then run Rserve in process
library('Rserve')
run.Rserve()
