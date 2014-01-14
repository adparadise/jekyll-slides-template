module Jekyll
  class BackgroundVideo < Liquid::Tag
    def initialize(tag_name, name, tokens)
      super
      @name = name.strip
      @aspect = 1.44
      @crop = 0.6
    end

    def render(context)
      ["<div class=\"bgvideo-positioning\">",
       "  <div class=\"bgvideo-container\" style=\"padding-bottom: #{100/@aspect}%;\" data-crop=\"#{@crop}\">",
       "    <video width=\"100%\" height=\"#{100 / @aspect}%\" name=\"Video-#{@name}\" autoplay=\"true\" loop=\"true\" muted=\"true\" src=\"videos/#{@name}.m4v\">",
       "    </video>",
       "  </div>",
       "</div>"].join("\n");
    end
  end
end
Liquid::Template.register_tag('bgvideo', Jekyll::BackgroundVideo)

