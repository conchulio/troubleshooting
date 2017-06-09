#!/usr/bin/env ruby

# require 'byebug'
require 'sinatra/base'
require 'json'
require 'date'

class App < Sinatra::Base
  configure :production, :development do
    enable :logging
    # console log to file
    log_path = "#{root}/log" 
    Dir.mkdir(log_path) unless File.exist?(log_path)
    log_file = File.new("#{log_path}/#{settings.environment}.log", "a+")
    log_file.sync = true
    $stdout.reopen(log_file)
    $stderr.reopen(log_file)
  end

  @@directory_name = 'collected_data'

  set :public_folder, 'experiments'

  # get '/multicast' do
  #   send_file 'experiments/multicast.html'
  # end

  post '/new_file' do
    p params
    received_things = request.body.read
    p received_things
    received_json = JSON.parse received_things
    # current_date = DateTime.now.to_s
    # p current_date
    # minimum_timestamp = received_things.scan(/(?<=\"ts\"\:)\d+/).map{|item| DateTime.strptime((item.to_i.fdiv(1000).round+Time.now.getlocal.gmtoff).to_s,'%s')}.min.to_s
    minimum_timestamp = DateTime.strptime((received_json[3][0]['result']['ts'].fdiv(1000).round+Time.now.getlocal.gmtoff).to_s,'%s').to_s
    p minimum_timestamp
    Dir.mkdir(@@directory_name) unless File.exists?(@@directory_name)
    File.open("#{@@directory_name}/file_#{minimum_timestamp.gsub(/:/, '-').split('+')[0]}.json", 'w') { |file| file.write(received_things) }
    # byebug
    headers \
      'Access-Control-Allow-Origin' => '*'
    "Success"
  end

  run! if app_file == $0

end

# App.new
