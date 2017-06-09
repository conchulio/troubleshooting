from __future__ import with_statement
from fabric.api import *
from fabric.contrib.console import confirm
from fabric.context_managers import cd
from datetime import datetime

date_pattern = '%Y-%m-%dT%H-%M-%S'
packet_trace_file_name = 'packet_traces_'+datetime.now().strftime(date_pattern)

boss = 'imachine'


websites = ['http://google.fr', 'http://youtube.com', 'http://facebook.com', 'http://google.com', 'http://leboncoin.fr', 'http://bing.com', 'http://orange.fr', 'http://yahoo.com', 'http://amazon.fr', 'http://live.com']

env.shell = 'ash -l -c'
env.params_per_host = {
  'lenovolinux':{'directory':'~/', 'interface':'eth0', 'path_to_firefox': 'firefox', 'path_to_chrome': 'chromium-browser', 'webpage': 'all.html'},
  'imachine':{'directory':'~/Documents/Studium/inria/', 'interface':'en3', 'path_to_firefox': '/Applications/Firefox.app/Contents/MacOS/firefox', 'path_to_chrome': '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'webpage': 'passive-peer.html'},
  'imachineretired':{'directory':'~/Documents/Studium/inria/', 'interface':'en5', 'path_to_firefox': '/Applications/Firefox.app/Contents/MacOS/firefox', 'path_to_chrome': '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'webpage': 'all.html'},
  'observer':{'directory':'~/', 'interface':'en0', 'path_to_chrome': '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'webpage': 'remote-end.html'},
  'demo-pc':{'directory':'~/', 'path_to_firefox': '/c/Program Files (x86)/Mozilla Firefox/firefox', 'path_to_chrome': '/c/Program Files (x86)/Google/Chrome/Application/chrome', 'path_to_edge':'/c/Windows/SystemApps/Microsoft.MicrosoftEdge_8wekyb3d8bbwe/MicrosoftEdge', 'webpage': 'all.html'},
  # 'localhost':{'directory':'~/Documents/Studium/inria/', 'interface':'en0', 'path_to_chrome': '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'webpage': 'all.html'}
}

def shutdown(minutes=600):
  sudo('shutdown -h +'+str(minutes))

def kill_server():
  env.warn_only = True
  run('kill `ps aux | grep "node" | grep -v "grep" | awk \'{ print $2 }\'`')
  run('tskill node')
  env.warn_only = False
  run('sleep 2')

def launch_server(hostname1, hostname2):
  kill_server()
  d = env.params_per_host[env.host]['directory']
  with cd(d+'fathom.private/experiments'):
    run('nohup /bin/bash -c $\'IS_BOSS='+str(boss==env.host).upper()+' hostnames=\\\''+'["'+hostname1+'","'+hostname2+'"]'+'\\\' node server &>log/log < /dev/null &\' > /dev/null 2> /dev/null < /dev/null &', pty=False)

def launch_websocket_server():
  d = env.params_per_host[env.host]['directory']
  env.warn_only = True
  run('kill `ps aux | grep "node" | grep -v "grep" | awk \'{ print $2 }\'`')
  env.warn_only = False
  run('sleep 2')
  with cd(d+'fathom.private/experiments'):
    run('dtach -n /tmp/webrtc_server -z /bin/bash -c \'node websocket-server &>log/log < /dev/null &\'', pty=False)
    run('dtach -n /tmp/ping_server -z /bin/bash -c \'node new-websocket-server &>log/log2 < /dev/null &\'', pty=False)

def kill_chrome():
  env.warn_only = True
  run('kill `ps aux | grep "hrom" | grep -v "grep" | grep -v "python" | awk \'{ print $2 }\'`')
  run('tskill chrome')
  env.warn_only = False
  run('sleep 2')

def kill_firefox():
  env.warn_only = True
  run('kill `ps aux | grep "irefox" | grep -v "grep" | grep -v "python" | awk \'{ print $2 }\'`')
  run('tskill firefox')
  env.warn_only = False
  run('sleep 2')

def kill_edge():
  env.warn_only = True
  run('kill `ps aux | grep "Edge" | grep -v "grep" | grep -v "python" | awk \'{ print $2 }\'`')
  run('tskill MicrosoftEdge')
  env.warn_only = False
  run('sleep 2')

def launch_chrome(active_browsing=False):
  page = env.params_per_host[env.host]['webpage']
  if page=='all.html' and active_browsing:
    args = ' '.join(websites)
  else:
    args = ' '
  host_machine = 'localhost' if env.host=='observer' else 'imachine'
  kill_chrome()
  kill_firefox()
  # kill_edge()
  run("export DISPLAY=:0 ; nohup \'"+env.params_per_host[env.host]['path_to_chrome']+'\' http://'+host_machine+':43234/'+page+' '+args+' > /dev/null 2> /dev/null < /dev/null &', pty=False)

def launch_firefox(active_browsing=False):
  page = env.params_per_host[env.host]['webpage']
  if page=='all.html' and active_browsing:
    args = ' '.join(websites)
  else:
    args = ' '
  host_machine = 'localhost' if env.host=='observer' else 'imachine'
  kill_chrome()
  kill_firefox()
  # kill_edge()
  run("export DISPLAY=:0 ; nohup \'"+env.params_per_host[env.host]['path_to_firefox']+'\' http://'+host_machine+':43234/'+page+' '+args+' > /dev/null 2> /dev/null < /dev/null &', pty=False)

def launch_edge(active_browsing=False):
  page = env.params_per_host[env.host]['webpage']
  if page=='all.html' and active_browsing:
    args = '; start microsoft-edge:'.join(websites)
    args = 'start microsoft-edge:'+args
  else:
    args = ' '
  host_machine = 'localhost' if env.host=='observer' else 'imachine'
  kill_chrome()
  kill_firefox()
  # kill_edge()
  run("export DISPLAY=:0 ; nohup bash -c \'start microsoft-edge:http://"+host_machine+':43234/'+page+'; '+args+'\' > /dev/null 2> /dev/null < /dev/null &', pty=False)


def kill_packet_capture():
  env.warn_only = True
  sudo('kill `ps aux | grep "tcpdump" | grep -v "grep" | awk \'{ print $2 }\'`')
  env.warn_only = False
  run('sleep 2')

def capture_packets():
  d = env.params_per_host[env.host]['directory']
  kill_packet_capture()
  sudo('dtach -n /tmp/tcpdump -z tcpdump -s0 -i '+env.params_per_host[env.host]['interface']+' -w '+d+'fathom.private/packet_traces/'+packet_trace_file_name+'.pcap', pty=False)

# def kill_server():
#   env.warn_only = True
#   run('kill `ps aux | grep "./server.rb" | grep -v "grep" | awk \'{ print $2 }\'`')
#   env.warn_only = False
#   run('sleep 2')

# def start_server():
#   d = env.params_per_host[env.host]['directory']
#   kill_server()
#   with cd(d+'fathom.private'):
#     run('dtach -n /tmp/server -z ruby '+d+'fathom.private/server.rb', pty=False)

# def launch_gedit():
#   run('dtach -n /tmp/gedit -z gedit', pty=False)

def kill_jpm():
  env.warn_only = True
  run('kill `ps aux | grep "node" | grep -v "grep" | awk \'{ print $2 }\'`')
  env.warn_only = False
  run('sleep 2')

def run_jpm():
  d = env.params_per_host[env.host]['directory']
  kill_jpm()
  path_to_firefox = ''
  if env.host == 'lenovolinux':
    path_to_firefox = '-b /usr/bin/firefox'
  with cd(d+'fathom.addon'):
    print(d+'fathom.addon')
    run('export DISPLAY=:0 ; dtach -n /tmp/jpm -z jpm run -v --debug '+path_to_firefox+' --binary-args http://localhost:4567/multicast.html', pty=False)

def host_type():
  run('uname -s')

def inspect_environment():
  print(env)

def restart_network():
  run('/etc/init.d/network restart')

def get_configuration(which_one):
  get('/etc/config/'+which_one,'./'+env.hosts[0])

def put_configuration(which_one):
  print('env.hosts'+env.hosts[0])
  put('./'+env.hosts[0]+'/'+which_one,'/etc/config/'+which_one)

def list_wifi(what):
  run('sudo -u user iwlist wlan0 '+what)

def set_wifi(what):
  run('iwconfig wlan0 '+what)

# def list_iw(what):
#   run('iw dev wlan0 '+what)

def set_iw(what):
  run('iw dev wlan0 set '+what)

def set_iw_rate(rate):
  set_iw('bitrates legacy-2.4 '+rate)

def delete_tc(interface):
  env.warn_only = True
  run('tc qdisc del dev '+interface+' root netem')
  env.warn_only = False

def add_tc(interface, what):
  delete_tc(interface)
  run('tc qdisc add dev '+interface+' root netem '+what)

def delete_both_ways():
  if env.hosts[0]!='bridge':
    raise Exception('Only use tc for the bridge')
  delete_tc('eth1')
  delete_tc('eth0.2')

# def disable

def add_both_ways(what):
  if env.hosts[0]!='bridge':
    raise Exception('Only use tc for the bridge')
  add_tc('eth1', what)
  add_tc('eth0.2', what)

# On bridge:
# eth1 is the WAN, eth0.2 is the bridge to the router
