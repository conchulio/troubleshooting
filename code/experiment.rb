#!/usr/bin/env ruby
require 'rinruby'
require 'thread'
require 'timeout'

$r=RinRuby.new echo: false

$names = ['router', 'self', 'router:self']

# def evaluate array
#   $r.eval "
#     library(Hmisc)
#     rcorr(c(#{array[0]}), c(#{array[1]}), type='pearson')
#   "
# end

# def evaluate array
#   $r.eval "
#     cor(data.frame(x=c(#{array[0]}), y=c(#{array[1]})))
#   "
# end

def evaluate array
  # puts array.inspect

  # puts "in evaluate"

  $r.eval <<-EOF
    summary.as.string <- summary(lm(serverData ~ routerData*selfData, data.frame(serverData=c(#{array[0]}), routerData=c(#{array[1]}), selfData=c(#{array[2]}))))
    # print(summary.as.string)
  EOF

  # $r.eval <<-EOF
  #   summary(lm(serverData ~ routerData*selfData, data.frame(serverData=c(#{array[0]}), routerData=c(#{array[1]}), selfData=c(#{array[2]}))))
  # EOF

  raw_coefficients = $r.pull <<-EOF
    summary.as.string$coefficients
  EOF

  r_squared = $r.pull <<-EOF
    summary.as.string$r.squared
  EOF

  adj_r_squared = $r.pull <<-EOF
    summary.as.string$adj.r.squared
  EOF

  raw_coefficients = raw_coefficients.row_vectors.map{|i| i.to_a}
  raw_coefficients.shift
  coefficients = raw_coefficients.map{|i| i[0].to_f.round(2)}
  p_values = raw_coefficients.map{|i| i[3].to_f}
  named_coefficients = $names.zip coefficients, p_values
  coefficients_string = named_coefficients.map{|i| "#{i[0]}:#{i[1]}:#{i[2].round(3)}"}.reduce{|a,i| a+","+i}

  puts "Coefficients:#{coefficients_string}, adj.r:#{adj_r_squared},r:#{r_squared}"

  # lm_result = $r.pull "cor(data.frame(x=c(#{array[0]}), y=c(#{array[1]})))"
  # puts lm_result
end

$thread_results = []
$factor = 4.0
$lookback = 175
$highest_evaluated_so_far = 0

$results_queue = Queue.new
$counter_mutex = Mutex.new
$counter = 0

def ping id, number, target, label
  number.times do |i|
    print "#{i.inspect[-1]},"
    # random_nap = (0.05/$factor)*rand
    # random_nap = 0.00025*rand
    random_nap = 0
    now = Time.now.to_f*$factor
    # puts "sleeping for #{(now.ceil - now)/$factor}"
    sleep (now.ceil - now)/$factor + random_nap
    # print label
    # puts "#{id} pinging #{i} at #{Time.now}"

    # puts "before begin"
    # begin
    # Thread.new do
      result = nil
      begin
      Timeout.timeout(0.15) do
        # puts 'waiting for the process to end'
        result = `ping -c 1 #{target}`
        # puts 'process finished in time'
      end
      rescue Timeout::Error
        puts 'process not finished in time, killing it'
      #   # Process.kill('TERM', pid)
      #   result = nil
      end
      # puts result

      filtered_time = /(?<=time=)\d*(?:\.\d*)?/.match(result)
      item_to_add = filtered_time ? filtered_time[0].to_f : filtered_time
      results_to_evaluate = nil
      $counter_mutex.synchronize do
        if !$thread_results[i]
          $thread_results[i] = [nil, nil, nil]
        end
        $thread_results[i][id] = item_to_add
        # $thread_results[id].push(item_to_add)
        # if $highest_evaluated_so_far < i && !$thread_results[i].include?(nil) && $thread_results.length > $lookback
        #   if $highest_evaluated_so_far % 30 == 0
        #     results_to_evaluate = $thread_results.slice(-$lookback..-1)
        #   end
        #   $highest_evaluated_so_far = i
        # end
      end
      # puts $thread_results.inspect
      # if results_to_evaluate
      #   # print "#{results[0].length.to_s[-1]},#{results[1].length.to_s[-1]},#{results[2].length.to_s[-1]};"
      #   $results_queue.push results_to_evaluate
      # end
    # end
  end
end

times = 1000

gateway_address = `netstat -r -f inet`[/default.*/][/(\d+\.\d+\.\d+\.\d+|\p{Alnum}+\.\p{Alnum}+)/]
second_hop_address = `traceroute -m 2 google.com`[/ 2  .*/][/\d+\.\d+\.\d+\.\d+/]
# mlab = `curl http://mlab-ns.appspot.com/ndt`[/\d+\.\d+\.\d+\.\d+/]

t1 = Thread.new {ping 0, times, second_hop_address, 's'}
t2 = Thread.new {ping 1, times, gateway_address, 'r'}
t3 = Thread.new {ping 2, times, '127.0.0.1', 'l'}

# evaluation_counter = 0
# loop do
  # evaluation_counter += 1
  # if evaluation_counter%10 == 0
    # if !t1.alive? && !t2.alive? && !t3.alive?
      # $results_queue.push $thread_results
    # end
    # array = $results_queue.pop

    t1.join
    t2.join
    t3.join
    array = $thread_results
    # puts array.inspect
    filtered_array = array.select{|item| item && item[0] && item[1] && item[2]}
    # puts filtered_array.inspect
    if filtered_array.length != array.length
      puts "Dropped #{array.length-filtered_array.length} items"
    end
    results = filtered_array.transpose
    print "#{results[0][-1] ? results[0][-1].round(2) : nil},#{results[1][-1] ? results[1][-1].round(2) : nil},#{results[2][-1] ? results[2][-1].round(2) : nil}\t"
    # print "#{results[0][-1].round(2)}:#{results[0][-11].round(2)},#{results[1][-1].round(2)}:#{results[1][-11].round(2)},#{results[2][-1].round(2)}:#{results[2][-11].round(2)}\t"
    # puts "#{results[0].map{|item| item.round(2)}},#{results[1].map{|item| item.round(2)}},#{results[2].map{|item| item.round(2)}}\t"
    new_results = results.map{|item| item.inspect.slice((1..-2))}

    evaluate new_results
  # else
  #   $results_queue.pop
  # end
# end

# mapped_results = $thread_results.map {|item| item.inspect.slice((1..-2))}
# puts mapped_results
# puts "Ended threads"
