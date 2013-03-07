require 'fileutils'
require 'digest/md5'
require 'pathname'

HOME = Pathname.new(__FILE__).dirname

module Jekyll
  class DitaaBlock < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super

      @ditaa_exists = system('which ditaa > /dev/null 2>&1')

      # There is always a blank line at the beginning, so we remove to get rid
      # of that undesired top padding in the ditaa output
      ditaa = @nodelist.to_s
      ditaa.gsub!('\n', "\n")
      ditaa.gsub!(/^\[\"\n/, "")
      ditaa.gsub!(/\"\]$/, "")
      ditaa.gsub!(/\n+$/, "")
      ditaa.gsub!(/\\\\/, "\\")

      hash = Digest::MD5.hexdigest(ditaa)
      ditaa_home = 'images/ditaa/'
      FileUtils.mkdir_p(ditaa_home)
      png_name = 'ditaa-' + hash + '.png'
      @png_path = ditaa_home + png_name

      if @ditaa_exists
        if not File.exists?(@png_path)
          options = ' -E -s2 -o'
          File.open('/tmp/ditaa-foo.txt', 'w') {|f| f.write(ditaa)}
          commands = ['ditaa /tmp/ditaa-foo.txt ' + @png_path + options,
                      'convert ' + @png_path + ' -trim ' + @png_path,
                      'convert ' + @png_path + ' -trim ' + @png_path]
          system(commands.join("; "))
        end
      end
      @png_exists = File.exists?(@png_path)
    end

    def render(context)
      if @png_exists
        '<figure><img src="' + @png_path + '" /></figure>'
      else
        '<code><pre>' + super + '</pre></code>'
      end
    end
  end
end

Liquid::Template.register_tag('ditaa', Jekyll::DitaaBlock)
